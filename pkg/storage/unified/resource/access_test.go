package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	appvalidation "github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	zanzanacommon "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util"
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

func TestAuthzLimitedClient_NotebookAuthorizationCompatibility(t *testing.T) {
	const (
		namespace   = "stacks-1"
		notebookUID = "same-uid"
		folderUID   = "folder-1"
	)

	notebookResource := dashboardv2beta1.NotebookResourceInfo.GroupResource()
	dashboardResource := dashboardv1.DashboardResourceInfo.GroupResource()
	user := &identity.StaticRequester{Namespace: namespace}

	t.Run("Check remaps notebooks and preserves request metadata", func(t *testing.T) {
		recorder := &recordingAccessClient{}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})
		req := authlib.CheckRequest{
			Group:       notebookResource.Group,
			Resource:    notebookResource.Resource,
			Verb:        utils.VerbGet,
			Namespace:   namespace,
			Name:        notebookUID,
			Subresource: "status",
			Path:        "/apis/dashboard.grafana.app/v2beta1/notebooks/same-uid",
			SkipCache:   true,
		}

		_, err := client.Check(context.Background(), user, req, folderUID)
		require.NoError(t, err)
		require.Len(t, recorder.checks, 1)
		expected := req
		expected.Group = dashboardResource.Group
		expected.Resource = dashboardResource.Resource
		expected.Name = notebookAuthorizationName(notebookUID)
		require.Equal(t, recordedCheck{request: expected, folder: folderUID}, recorder.checks[0])
	})

	t.Run("Check preserves an empty notebook name", func(t *testing.T) {
		recorder := &recordingAccessClient{}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})

		_, err := client.Check(context.Background(), user, authlib.CheckRequest{
			Group: notebookResource.Group, Resource: notebookResource.Resource, Verb: utils.VerbCreate, Namespace: namespace,
		}, folderUID)
		require.NoError(t, err)
		require.Len(t, recorder.checks, 1)
		require.Empty(t, recorder.checks[0].request.Name)
	})

	t.Run("Compile remaps later item names and preserves empty names", func(t *testing.T) {
		recorder := &recordingAccessClient{}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})
		req := authlib.ListRequest{
			Group:       notebookResource.Group,
			Resource:    notebookResource.Resource,
			Verb:        utils.VerbList,
			Namespace:   namespace,
			Subresource: "status",
			SkipCache:   true,
		}

		//nolint:staticcheck // SA1019: Compile is deprecated but still used by unified storage.
		checker, _, err := client.Compile(context.Background(), user, req)
		require.NoError(t, err)
		require.Len(t, recorder.lists, 1)
		expected := req
		expected.Group = dashboardResource.Group
		expected.Resource = dashboardResource.Resource
		require.Equal(t, expected, recorder.lists[0])

		checker(notebookUID, folderUID)
		checker("", folderUID)
		require.Equal(t, []checkedItem{
			{name: notebookAuthorizationName(notebookUID), folder: folderUID},
			{name: "", folder: folderUID},
		}, recorder.items)
	})

	t.Run("BatchCheck remaps notebooks and leaves other items unchanged", func(t *testing.T) {
		recorder := &recordingAccessClient{}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})
		modified := time.Now().UTC().Truncate(time.Second)
		notebookCheck := authlib.BatchCheckItem{
			CorrelationID:      "notebook",
			Group:              notebookResource.Group,
			Resource:           notebookResource.Resource,
			Verb:               utils.VerbGet,
			Name:               notebookUID,
			Subresource:        "status",
			Path:               "/apis/dashboard.grafana.app/v2beta1/notebooks/same-uid",
			Folder:             folderUID,
			FreshnessTimestamp: modified,
		}
		emptyNameCheck := authlib.BatchCheckItem{
			CorrelationID: "create",
			Group:         notebookResource.Group,
			Resource:      notebookResource.Resource,
			Verb:          utils.VerbCreate,
			Folder:        folderUID,
		}
		dashboardCheck := authlib.BatchCheckItem{
			CorrelationID: "dashboard",
			Group:         dashboardResource.Group,
			Resource:      dashboardResource.Resource,
			Verb:          utils.VerbGet,
			Name:          notebookUID,
			Folder:        folderUID,
		}
		unknownCheck := authlib.BatchCheckItem{
			CorrelationID: "unknown",
			Group:         "example.grafana.app",
			Resource:      "widgets",
			Verb:          utils.VerbGet,
			Name:          "widget-1",
		}

		resp, err := client.BatchCheck(context.Background(), user, authlib.BatchCheckRequest{
			Namespace: namespace,
			Checks:    []authlib.BatchCheckItem{notebookCheck, emptyNameCheck, dashboardCheck, unknownCheck},
			SkipCache: true,
		})
		require.NoError(t, err)
		require.Len(t, recorder.batches, 1)
		require.True(t, recorder.batches[0].SkipCache)
		require.Equal(t, namespace, recorder.batches[0].Namespace)
		require.Len(t, recorder.batches[0].Checks, 3)

		expectedNotebook := notebookCheck
		expectedNotebook.Group = dashboardResource.Group
		expectedNotebook.Resource = dashboardResource.Resource
		expectedNotebook.Name = notebookAuthorizationName(notebookUID)
		expectedEmpty := emptyNameCheck
		expectedEmpty.Group = dashboardResource.Group
		expectedEmpty.Resource = dashboardResource.Resource
		require.Equal(t, []authlib.BatchCheckItem{expectedNotebook, expectedEmpty, dashboardCheck}, recorder.batches[0].Checks)
		require.True(t, resp.Results[unknownCheck.CorrelationID].Allowed)
	})

	t.Run("non-notebook requests pass through unchanged", func(t *testing.T) {
		recorder := &recordingAccessClient{}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})
		checkReq := authlib.CheckRequest{
			Group: dashboardResource.Group, Resource: dashboardResource.Resource, Verb: utils.VerbGet,
			Namespace: namespace, Name: notebookUID, SkipCache: true,
		}

		_, err := client.Check(context.Background(), user, checkReq, folderUID)
		require.NoError(t, err)
		require.Equal(t, []recordedCheck{{request: checkReq, folder: folderUID}}, recorder.checks)

		listReq := authlib.ListRequest{
			Group: dashboardResource.Group, Resource: dashboardResource.Resource, Verb: utils.VerbList,
			Namespace: namespace, Subresource: "status", SkipCache: true,
		}
		//nolint:staticcheck // SA1019: Compile is deprecated but still used by unified storage.
		checker, _, err := client.Compile(context.Background(), user, listReq)
		require.NoError(t, err)
		require.Equal(t, []authlib.ListRequest{listReq}, recorder.lists)
		checker(notebookUID, folderUID)
		require.Equal(t, []checkedItem{{name: notebookUID, folder: folderUID}}, recorder.items)
	})
}

func TestNotebookAuthorizationNameIsReservedAndRepresentable(t *testing.T) {
	const notebookUID = "same-uid"
	name := notebookAuthorizationName(notebookUID)

	require.Error(t, util.ValidateUID(name))
	require.NotEmpty(t, appvalidation.IsValidGrafanaName(name))

	rbacScope := accesscontrol.GetResourceScopeUID("dashboards", name)
	require.True(t, accesscontrol.ValidateScope(rbacScope))
	_, _, scopeName := accesscontrol.SplitScope(rbacScope)
	require.Equal(t, name, scopeName)
	require.NotEqual(t, accesscontrol.GetResourceScopeUID("dashboards", notebookUID), rbacScope)

	dashboardResource := dashboardv1.DashboardResourceInfo.GroupResource()
	resourceInfo := zanzanacommon.NewResourceInfoFromCheck(&authzv1.CheckRequest{
		Group: dashboardResource.Group, Resource: dashboardResource.Resource, Name: name,
	})
	resourceIdent := resourceInfo.ResourceIdent()
	require.Equal(t, "resource:dashboard.grafana.app/dashboards/notebook/same-uid", resourceIdent)
	objectType, objectName, relation := zanzanacommon.SplitTupleObject(resourceIdent)
	require.Equal(t, "resource", objectType)
	require.Equal(t, "dashboard.grafana.app/dashboards/notebook/same-uid", objectName)
	require.Empty(t, relation)
}

func TestAuthzLimitedClient_NotebookAuthorizationBehavior(t *testing.T) {
	const (
		namespace   = "stacks-1"
		notebookUID = "same-uid"
		folderUID   = "folder-1"
	)

	notebookResource := dashboardv2beta1.NotebookResourceInfo.GroupResource()
	dashboardResource := dashboardv1.DashboardResourceInfo.GroupResource()
	user := &identity.StaticRequester{Namespace: namespace}
	check := func(t *testing.T, resource string, allow func(name, folder string) bool) bool {
		t.Helper()
		recorder := &recordingAccessClient{allow: allow}
		client := NewAuthzLimitedClient(recorder, AuthzOptions{})
		resp, err := client.Check(context.Background(), user, authlib.CheckRequest{
			Group: notebookResource.Group, Resource: resource, Verb: utils.VerbGet,
			Namespace: namespace, Name: notebookUID,
		}, folderUID)
		require.NoError(t, err)
		return resp.Allowed
	}

	t.Run("matching dashboard UID permission does not authorize a notebook", func(t *testing.T) {
		allowed := check(t, notebookResource.Resource, func(name, _ string) bool { return name == notebookUID })
		require.False(t, allowed)
	})

	t.Run("dashboard wildcard permission authorizes a notebook", func(t *testing.T) {
		allowed := check(t, notebookResource.Resource, func(_, _ string) bool { return true })
		require.True(t, allowed)
	})

	t.Run("dashboard folder inheritance authorizes a notebook", func(t *testing.T) {
		allowed := check(t, notebookResource.Resource, func(_, folder string) bool { return folder == folderUID })
		require.True(t, allowed)
	})

	t.Run("matching dashboard UID still authorizes the dashboard", func(t *testing.T) {
		allowed := check(t, dashboardResource.Resource, func(name, _ string) bool { return name == notebookUID })
		require.True(t, allowed)
	})
}

type recordedCheck struct {
	request authlib.CheckRequest
	folder  string
}

type checkedItem struct {
	name   string
	folder string
}

type recordingAccessClient struct {
	checks  []recordedCheck
	lists   []authlib.ListRequest
	items   []checkedItem
	batches []authlib.BatchCheckRequest
	allow   func(name, folder string) bool
}

func (c *recordingAccessClient) allowed(name, folder string) bool {
	return c.allow != nil && c.allow(name, folder)
}

func (c *recordingAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	c.checks = append(c.checks, recordedCheck{request: req, folder: folder})
	return authlib.CheckResponse{Allowed: c.allowed(req.Name, folder)}, nil
}

func (c *recordingAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	c.lists = append(c.lists, req)
	return func(name, folder string) bool {
		c.items = append(c.items, checkedItem{name: name, folder: folder})
		return c.allowed(name, folder)
	}, authlib.NoopZookie{}, nil
}

func (c *recordingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	c.batches = append(c.batches, req)
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: c.allowed(check.Name, check.Folder)}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
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
