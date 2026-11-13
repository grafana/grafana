package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/notebooks"
)

func TestNotebookAuthorizer(t *testing.T) {
	setNotebooksToggle(t, true)
	authz := newNotebookAuthorizer(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), nil)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	// Permissions as granted by the fixed notebooks roles in pkg/api/accesscontrol.go.
	none := map[string][]string{}
	viewer := map[string][]string{
		notebooks.ActionNotebooksRead: {notebooks.ScopeNotebooksAll},
	}
	editor := map[string][]string{
		notebooks.ActionNotebooksRead:   {notebooks.ScopeNotebooksAll},
		notebooks.ActionNotebooksWrite:  {notebooks.ScopeNotebooksAll},
		notebooks.ActionNotebooksDelete: {notebooks.ScopeNotebooksAll},
		notebooks.ActionNotebooksCreate: {folder.ScopeFoldersAll},
	}

	tests := []struct {
		name      string
		perms     map[string][]string
		verb      string
		resName   string
		wantAllow bool
	}{
		{name: "role none cannot list", perms: none, verb: "list"},
		{name: "role none cannot get", perms: none, verb: "get", resName: "nb"},
		{name: "role none cannot watch", perms: none, verb: "watch"},
		{name: "role none cannot create", perms: none, verb: "create"},
		{name: "role none cannot update", perms: none, verb: "update", resName: "nb"},
		{name: "role none cannot patch", perms: none, verb: "patch", resName: "nb"},
		{name: "role none cannot delete", perms: none, verb: "delete", resName: "nb"},
		{name: "role none cannot delete collection", perms: none, verb: "deletecollection"},

		{name: "viewer can list", perms: viewer, verb: "list", wantAllow: true},
		{name: "viewer can get", perms: viewer, verb: "get", resName: "nb", wantAllow: true},
		{name: "viewer can watch", perms: viewer, verb: "watch", wantAllow: true},
		{name: "viewer cannot create", perms: viewer, verb: "create"},
		{name: "viewer cannot update", perms: viewer, verb: "update", resName: "nb"},
		{name: "viewer cannot patch", perms: viewer, verb: "patch", resName: "nb"},
		{name: "viewer cannot delete", perms: viewer, verb: "delete", resName: "nb"},
		{name: "viewer cannot delete collection", perms: viewer, verb: "deletecollection"},

		{name: "editor can list", perms: editor, verb: "list", wantAllow: true},
		{name: "editor can create", perms: editor, verb: "create", wantAllow: true},
		{name: "editor can update", perms: editor, verb: "update", resName: "nb", wantAllow: true},
		{name: "editor can patch", perms: editor, verb: "patch", resName: "nb", wantAllow: true},
		{name: "editor can delete", perms: editor, verb: "delete", resName: "nb", wantAllow: true},

		{name: "create on the general folder alone does not grant read", perms: map[string][]string{notebooks.ActionNotebooksCreate: {generalScope}}, verb: "list"},
		{name: "unsupported verb is denied", perms: editor, verb: "proxy", resName: "nb"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: tc.perms},
			})
			attr := authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), tc.verb).(authorizer.AttributesRecord)
			attr.Name = tc.resName

			decision, _, err := authz.Authorize(ctx, attr)
			require.NoError(t, err)
			if tc.wantAllow {
				require.Equal(t, authorizer.DecisionAllow, decision)
			} else {
				require.Equal(t, authorizer.DecisionDeny, decision)
			}
		})
	}

	t.Run("denies when there is no requester", func(t *testing.T) {
		decision, _, err := authz.Authorize(context.Background(), authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), "list"))
		require.Error(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("denies every verb when the feature is disabled, even with full permissions", func(t *testing.T) {
		setNotebooksToggle(t, false)
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: editor},
		})
		for _, verb := range []string{"get", "list", "watch", "create", "update", "patch", "delete", "deletecollection"} {
			decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), verb))
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision, verb)
			require.Equal(t, "notebooks feature is not enabled", reason, verb)
		}
	})
}

func TestNotebookAuthorizer_NilAccessControl(t *testing.T) {
	setNotebooksToggle(t, true)

	t.Run("defers to the fallback authorizer", func(t *testing.T) {
		authz := newNotebookAuthorizer(nil, grafanaauthorizer.NewServiceAuthorizer())
		// The service authorizer errors without an identity, which proves the
		// request reached it.
		_, _, err := authz.Authorize(context.Background(), authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), "list"))
		require.ErrorContains(t, err, "no identity found")
	})

	t.Run("denies when there is no fallback", func(t *testing.T) {
		authz := newNotebookAuthorizer(nil, nil)
		decision, reason, err := authz.Authorize(context.Background(), authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), "list"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Equal(t, "access control is not configured", reason)
	})
}

// TestDashboardsAPIBuilderNotebookAuthorizerEnforcesRBAC verifies that the
// composite authorizer routes notebooks through the RBAC check when the
// builder has access control wired.
func TestDashboardsAPIBuilderNotebookAuthorizerEnforcesRBAC(t *testing.T) {
	setNotebooksToggle(t, true)
	authz := (&DashboardsAPIBuilder{
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
	}).GetAuthorizer()

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})
	decision, reason, err := authz.Authorize(ctx, authzAttributes(dashv2beta1.NotebookResourceInfo.GetName(), "list"))
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
}
