package resource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestAuthzLimitedClient_Check(t *testing.T) {
	mockClient := authlib.FixedAccessClient(false)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	tests := []struct {
		group    string
		resource string
		expected bool
	}{
		{"dashboard.grafana.app", "dashboards", false},
		{"folder.grafana.app", "folders", false},
		{"unknown.group", "unknown.resource", true},
	}

	for _, test := range tests {
		req := authlib.CheckRequest{
			Group:     test.group,
			Resource:  test.resource,
			Verb:      utils.VerbGet,
			Namespace: "stacks-1",
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req, "")
		assert.NoError(t, err)
		assert.Equal(t, test.expected, resp.Allowed)
	}
}

func TestAuthzLimitedClient_Compile(t *testing.T) {
	mockClient := authlib.FixedAccessClient(false)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	tests := []struct {
		group    string
		resource string
		expected bool
	}{
		{"dashboard.grafana.app", "dashboards", false},
		{"folder.grafana.app", "folders", false},
		{"unknown.group", "unknown.resource", true},
	}

	for _, test := range tests {
		req := authlib.ListRequest{
			Group:     test.group,
			Resource:  test.resource,
			Verb:      utils.VerbGet,
			Namespace: "stacks-1",
		}
		checker, _, err := client.Compile(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		assert.NoError(t, err)
		assert.NotNil(t, checker)

		result := checker("name", "folder")
		assert.Equal(t, test.expected, result)
	}
}

// TestNamespaceMatching tests namespace matching in Check and Compile methods
func TestNamespaceMatching(t *testing.T) {
	// Create a mock client that always returns allowed=true
	mockClient := authlib.FixedAccessClient(true)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	// Create a context with fallback disabled
	ctx := context.Background()

	tests := []struct {
		name          string
		authNamespace string
		reqNamespace  string
		expectError   bool
	}{
		{
			name:          "matching namespaces",
			authNamespace: "ns1",
			reqNamespace:  "ns1",
			expectError:   false,
		},
		{
			name:          "mismatched namespaces",
			authNamespace: "ns1",
			reqNamespace:  "ns2",
			expectError:   true,
		},
		{
			name:          "empty request namespace",
			authNamespace: "ns1",
			reqNamespace:  "",
			expectError:   true,
		},
		{
			name:          "empty auth namespace",
			authNamespace: "",
			reqNamespace:  "ns1",
			expectError:   true,
		},
		{
			name:          "wildcard auth namespace",
			authNamespace: "*",
			reqNamespace:  "ns1",
			expectError:   false,
		},
		{
			name:          "both empty namespaces",
			authNamespace: "",
			reqNamespace:  "",
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test Check method with namespace matching
			checkReq := authlib.CheckRequest{
				Group:     "unknown.group", // Use unknown group to bypass RBAC check
				Resource:  "unknown.resource",
				Verb:      utils.VerbGet,
				Namespace: tt.reqNamespace,
			}
			// Create a mock auth info with the specified namespace
			// Test Check method
			user := &identity.StaticRequester{Namespace: tt.authNamespace}
			_, checkErr := client.Check(ctx, user, checkReq, "")

			// Test Compile method
			compileReq := authlib.ListRequest{
				Group:     "unknown.group", // Use unknown group to bypass RBAC check
				Resource:  "unknown.resource",
				Verb:      utils.VerbGet,
				Namespace: tt.reqNamespace,
			}
			_, _, compileErr := client.Compile(ctx, user, compileReq)

			if tt.expectError {
				require.Error(t, checkErr, "Check should return error")
				require.Error(t, compileErr, "Compile should return error")
				assert.ErrorIs(t, checkErr, authlib.ErrNamespaceMismatch, "Check should return namespace mismatch error")
				assert.ErrorIs(t, compileErr, authlib.ErrNamespaceMismatch, "Compile should return namespace mismatch error")
			} else {
				assert.NoError(t, checkErr, "Check should not return error when namespaces match")
				assert.NoError(t, compileErr, "Compile should not return error when namespaces match")
			}
		})
	}
}

func TestAuthzLimitedClient_BatchCheck(t *testing.T) {
	mockClient := authlib.FixedAccessClient(true)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	t.Run("returns error when fallback is used", func(t *testing.T) {
		ctx := WithFallback(context.Background())
		req := authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{
					CorrelationID: "0",
					Group:         "dashboard.grafana.app",
					Resource:      "dashboards",
					Verb:          utils.VerbGet,
					Namespace:     "stacks-1",
					Name:          "test-dashboard",
				},
			},
		}

		_, err := client.BatchCheck(ctx, &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "fallback")
	})

	t.Run("works normally without fallback", func(t *testing.T) {
		ctx := context.Background()
		req := authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{
					CorrelationID: "0",
					Group:         "dashboard.grafana.app",
					Resource:      "dashboards",
					Verb:          utils.VerbGet,
					Namespace:     "stacks-1",
					Name:          "test-dashboard",
				},
			},
		}

		resp, err := client.BatchCheck(ctx, &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.Len(t, resp.Results, 1)
		assert.True(t, resp.Results["0"].Allowed)
	})

	t.Run("returns error on namespace mismatch", func(t *testing.T) {
		ctx := context.Background()
		req := authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{
					CorrelationID: "0",
					Group:         "dashboard.grafana.app",
					Resource:      "dashboards",
					Verb:          utils.VerbGet,
					Namespace:     "stacks-2", // Different namespace
					Name:          "test-dashboard",
				},
			},
		}

		_, err := client.BatchCheck(ctx, &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.Error(t, err)
		assert.ErrorIs(t, err, authlib.ErrNamespaceMismatch)
	})

	t.Run("allows non-RBAC resources by default", func(t *testing.T) {
		// Use a client that would deny if checked
		denyClient := authlib.FixedAccessClient(false)
		client := NewAuthzLimitedClient(denyClient, AuthzOptions{})

		ctx := context.Background()
		req := authlib.BatchCheckRequest{
			Checks: []authlib.BatchCheckItem{
				{
					CorrelationID: "0",
					Group:         "unknown.group",
					Resource:      "unknown.resource",
					Verb:          utils.VerbGet,
					Namespace:     "stacks-1",
					Name:          "test",
				},
			},
		}

		resp, err := client.BatchCheck(ctx, &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.Len(t, resp.Results, 1)
		assert.True(t, resp.Results["0"].Allowed, "non-RBAC resources should be allowed by default")
	})
}

// TestNamespaceMatchingFallback tests namespace matching in Check and Compile methods when fallback is used
func TestNamespaceMatchingFallback(t *testing.T) {
	// Create a mock client that always returns allowed=true
	mockClient := authlib.FixedAccessClient(true)
	client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

	// Create a context with fallback disabled
	ctx := context.Background()

	tests := []struct {
		name          string
		authNamespace string
		reqNamespace  string
		expectError   bool
	}{
		{
			name:         "with namespace fallback",
			reqNamespace: "ns1",
			expectError:  false,
		},
		{
			name:         "empty request namespace with fallback",
			reqNamespace: "",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test Check method with namespace matching
			checkReq := authlib.CheckRequest{
				Group:     "unknown.group", // Use unknown group to bypass RBAC check
				Resource:  "unknown.resource",
				Verb:      utils.VerbGet,
				Namespace: tt.reqNamespace,
			}
			ctx = WithFallback(ctx)
			// Create a mock auth info with the specified namespace
			// Test Check method
			user := &identity.StaticRequester{Namespace: tt.authNamespace}
			_, checkErr := client.Check(ctx, user, checkReq, "")

			// Test Compile method
			compileReq := authlib.ListRequest{
				Group:     "unknown.group", // Use unknown group to bypass RBAC check
				Resource:  "unknown.resource",
				Verb:      utils.VerbGet,
				Namespace: tt.reqNamespace,
			}
			_, _, compileErr := client.Compile(ctx, user, compileReq)

			if tt.expectError {
				require.Error(t, checkErr, "Check should return error")
				require.Error(t, compileErr, "Compile should return error")
				assert.ErrorContains(t, checkErr, "namespace empty", "Check should return namespace mismatch error")
				assert.ErrorContains(t, compileErr, "namespace empty", "Compile should return namespace mismatch error")
			} else {
				assert.NoError(t, checkErr, "Check should not return error when namespaces match")
				assert.NoError(t, compileErr, "Compile should not return error when namespaces match")
			}
		})
	}
}
