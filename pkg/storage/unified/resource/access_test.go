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

func TestAuthzLimitedClient_BatchCheck(t *testing.T) {
	t.Run("RBAC compatible resources should use underlying client", func(t *testing.T) {
		mockClient := authlib.FixedAccessClient(false)
		client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "check2", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet, Name: "folder1"},
			},
		}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.Len(t, resp.Results, 2)
		assert.False(t, resp.Results["check1"].Allowed)
		assert.False(t, resp.Results["check2"].Allowed)
	})

	t.Run("non-RBAC compatible resources should be allowed", func(t *testing.T) {
		mockClient := authlib.FixedAccessClient(false)
		client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check1", Group: "unknown.group", Resource: "unknown.resource", Verb: utils.VerbGet, Name: "item1"},
				{CorrelationID: "check2", Group: "another.group", Resource: "another.resource", Verb: utils.VerbGet, Name: "item2"},
			},
		}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.Len(t, resp.Results, 2)
		assert.True(t, resp.Results["check1"].Allowed)
		assert.True(t, resp.Results["check2"].Allowed)
	})

	t.Run("mixed resources - some RBAC compatible, some not", func(t *testing.T) {
		mockClient := authlib.FixedAccessClient(false)
		client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "dash1"},
				{CorrelationID: "check2", Group: "unknown.group", Resource: "unknown.resource", Verb: utils.VerbGet, Name: "item1"},
				{CorrelationID: "check3", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet, Name: "folder1"},
			},
		}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.Len(t, resp.Results, 3)
		// RBAC compatible - should be denied (mockClient returns false)
		assert.False(t, resp.Results["check1"].Allowed)
		// Not RBAC compatible - should be allowed
		assert.True(t, resp.Results["check2"].Allowed)
		// RBAC compatible - should be denied (mockClient returns false)
		assert.False(t, resp.Results["check3"].Allowed)
	})

	t.Run("RBAC compatible resources with allowed client", func(t *testing.T) {
		mockClient := authlib.FixedAccessClient(true)
		client := NewAuthzLimitedClient(mockClient, AuthzOptions{})

		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "check1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "dash1"},
			},
		}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.Len(t, resp.Results, 1)
		assert.True(t, resp.Results["check1"].Allowed)
	})
}

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
		//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
		checker, _, err := client.Compile(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		assert.NoError(t, err)
		assert.NotNil(t, checker)

		result := checker("name", "folder")
		assert.Equal(t, test.expected, result)
	}
}

func TestAuthzLimitedClient_NotebooksUseDashboardAuthorization(t *testing.T) {
	const (
		namespace  = "stacks-1"
		notebooks  = "notebooks"
		dashboards = "dashboards"
	)

	seen := make([]string, 0, 3)
	underlying := &callbackAccessClient{fn: func(req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
		seen = append(seen, req.Resource)
		return authlib.CheckResponse{Allowed: req.Group == "dashboard.grafana.app" && req.Resource == dashboards}, nil
	}}
	client := NewAuthzLimitedClient(underlying, AuthzOptions{})
	user := &identity.StaticRequester{Namespace: namespace}

	check, err := client.Check(context.Background(), user, authlib.CheckRequest{
		Group: "dashboard.grafana.app", Resource: notebooks, Verb: utils.VerbCreate, Namespace: namespace,
	}, "")
	require.NoError(t, err)
	require.True(t, check.Allowed)

	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, _, err := client.Compile(context.Background(), user, authlib.ListRequest{
		Group: "dashboard.grafana.app", Resource: notebooks, Verb: utils.VerbList, Namespace: namespace,
	})
	require.NoError(t, err)
	require.True(t, checker("nb1", ""))

	batch, err := client.BatchCheck(context.Background(), user, authlib.BatchCheckRequest{
		Namespace: namespace,
		Checks: []authlib.BatchCheckItem{{
			CorrelationID: "nb1", Group: "dashboard.grafana.app", Resource: notebooks, Verb: utils.VerbGet, Name: "nb1",
		}},
	})
	require.NoError(t, err)
	require.True(t, batch.Results["nb1"].Allowed)
	require.Equal(t, []string{dashboards, dashboards, dashboards}, seen)
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
			//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
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

func TestValidateAuthzOptions(t *testing.T) {
	for _, value := range []string{"", "group", "/resource", "group/", "group/resource/extra", "group/*"} {
		t.Run("rejects malformed exemption "+value, func(t *testing.T) {
			err := ValidateAuthzOptions(AuthzOptions{ExemptResources: []string{value}})
			require.ErrorContains(t, err, "invalid unified storage authz exemption")
		})
	}

	for _, value := range []string{
		"dashboard.grafana.app/dashboards",
		"folder.grafana.app/folders",
		"iam.grafana.app/users",
		"iam.grafana.app/teams",
		"iam.grafana.app/serviceaccounts",
		"plugin.ext.grafana.app/widgets",
	} {
		t.Run("rejects already enforced exemption "+value, func(t *testing.T) {
			err := ValidateAuthzOptions(AuthzOptions{ExemptResources: []string{value}})
			require.ErrorContains(t, err, "it is already enforced")
		})
	}

	t.Run("deduplicates exact exemptions", func(t *testing.T) {
		client := NewAuthzLimitedClient(authlib.FixedAccessClient(true), AuthzOptions{
			ExemptResources: []string{"example.grafana.app/widgets", "example.grafana.app/widgets"},
		})
		wrapped := client.(*authzLimitedClient)
		require.Len(t, wrapped.exemptions, 1)
		require.Len(t, wrapped.exemptions["example.grafana.app"], 1)
	})

	t.Run("client ignores exemptions that fail validation", func(t *testing.T) {
		client := NewAuthzLimitedClient(authlib.FixedAccessClient(true), AuthzOptions{
			ExemptionEnabled: true,
			ExemptResources:  []string{"example.grafana.app/widgets", "malformed"},
		})
		require.True(t, client.(*authzLimitedClient).IsCompatibleWithRBAC("example.grafana.app", "widgets"))
	})
}

func TestAuthzLimitedClientExemptionGate(t *testing.T) {
	exempted := AuthzOptions{ExemptionEnabled: true, ExemptResources: []string{"example.grafana.app/widgets"}}

	tests := []struct {
		name       string
		opts       AuthzOptions
		group      string
		resource   string
		isEnforced bool
	}{
		{"disabled enforces allowlist resource", AuthzOptions{}, "dashboard.grafana.app", "dashboards", true},
		{"disabled enforces extension group", AuthzOptions{}, "plugin.ext.grafana.app", "widgets", true},
		{"disabled bypasses unknown resource", AuthzOptions{}, "example.grafana.app", "widgets", false},
		{"disabled ignores exemptions", AuthzOptions{ExemptResources: exempted.ExemptResources}, "example.grafana.app", "widgets", false},
		{"enabled without exemptions enforces unknown resource", AuthzOptions{ExemptionEnabled: true}, "example.grafana.app", "widgets", true},
		{"enabled enforces dashboards", AuthzOptions{ExemptionEnabled: true}, "dashboard.grafana.app", "dashboards", true},
		{"enabled enforces folders", AuthzOptions{ExemptionEnabled: true}, "folder.grafana.app", "folders", true},
		{"enabled enforces iam", AuthzOptions{ExemptionEnabled: true}, "iam.grafana.app", "users", true},
		{"enabled enforces extension group", AuthzOptions{ExemptionEnabled: true}, "plugin.ext.grafana.app", "widgets", true},
		{"enabled bypasses exact exemption", exempted, "example.grafana.app", "widgets", false},
		{"enabled enforces sibling of exemption", exempted, "example.grafana.app", "gadgets", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewAuthzLimitedClient(authlib.FixedAccessClient(false), tt.opts)

			// The underlying client denies everything, so an allowed response means the check was bypassed.
			check, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, authlib.CheckRequest{
				Group: tt.group, Resource: tt.resource, Verb: utils.VerbGet, Namespace: "stacks-1", Name: "one",
			}, "")
			require.NoError(t, err)
			assert.Equal(t, !tt.isEnforced, check.Allowed)
		})
	}
}
