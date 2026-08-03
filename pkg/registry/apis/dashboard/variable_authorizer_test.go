package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestVariableAuthorizer(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	authz := NewVariableAuthorizer(ac)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	folderAScope := folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a")

	tests := []struct {
		name      string
		verb      string
		resName   string
		perms     map[string][]string
		wantAllow bool
	}{
		{
			name:      "viewer with root read can list",
			verb:      "list",
			perms:     map[string][]string{ActionVariablesRead: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "viewer without read cannot list",
			verb:      "list",
			perms:     map[string][]string{},
			wantAllow: false,
		},
		{
			name:      "editor with root create can create",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesCreate: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "viewer with folder create can create (coarse)",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesCreate: {folderAScope}},
			wantAllow: true,
		},
		{
			name:      "viewer without create cannot create",
			verb:      "create",
			perms:     map[string][]string{ActionVariablesRead: {generalScope}},
			wantAllow: false,
		},
		{
			name:      "write allowed with variable uid scope",
			verb:      "update",
			resName:   "region",
			perms:     map[string][]string{ActionVariablesWrite: {ScopeVariablesProvider.GetResourceScopeUID("region")}},
			wantAllow: true,
		},
		{
			name:      "root write can update folder-scoped variable (coarse; admission narrows)",
			verb:      "update",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesWrite: {generalScope}},
			wantAllow: true,
		},
		{
			name:      "delete denied without action",
			verb:      "delete",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesRead: {folderAScope}},
			wantAllow: false,
		},
		{
			name:      "delete allowed with variable uid scope",
			verb:      "delete",
			resName:   "region--folder-a",
			perms:     map[string][]string{ActionVariablesDelete: {ScopeVariablesProvider.GetResourceScopeUID("region--folder-a")}},
			wantAllow: true,
		},
		{
			name:      "root delete can delete folder-scoped variable (coarse; admission narrows)",
			verb:      "delete",
			resName:   "region--missing-folder",
			perms:     map[string][]string{ActionVariablesDelete: {generalScope}},
			wantAllow: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: tc.perms,
				},
			})
			decision, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
				ResourceRequest: true,
				Verb:            tc.verb,
				APIGroup:        "dashboard.grafana.app",
				Resource:        "variables",
				Name:            tc.resName,
			})
			require.NoError(t, err)
			if tc.wantAllow {
				require.Equal(t, authorizer.DecisionAllow, decision)
			} else {
				require.Equal(t, authorizer.DecisionDeny, decision)
			}
		})
	}
}

func TestVariableAuthorizer_OrphanedFolderScopedUpdate(t *testing.T) {
	// Regression: scoped update/delete used to resolve variables:uid via
	// GetInheritedScopes; when the parent folder was gone the resolver erred and
	// the authorizer denied before admission allowMissingFolder could run.
	acSvc := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	folderSvc := foldertest.NewFakeService()
	folderSvc.ExpectedError = folder.ErrFolderNotFound
	prefix, resolver := VariableUIDScopeResolver(folderSvc)
	acSvc.RegisterScopeAttributeResolver(prefix, resolver)

	authz := NewVariableAuthorizer(acSvc)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesWrite: {generalScope}},
		},
	})
	decision, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		Verb:            "update",
		APIGroup:        "dashboard.grafana.app",
		Resource:        "variables",
		Name:            "region--missing-folder",
	})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
}

func TestFolderUIDFromVariableMetadataName(t *testing.T) {
	require.Equal(t, accesscontrol.GeneralFolderUID, folderUIDFromVariableMetadataName("region"))
	require.Equal(t, "folder-a", folderUIDFromVariableMetadataName("region--folder-a"))
	// Folder UIDs may contain "--"; split on the first separator (spec names are \w+).
	require.Equal(t, "var--abc", folderUIDFromVariableMetadataName("my--var--abc"))
	require.Equal(t, "team--prod", folderUIDFromVariableMetadataName("region--team--prod"))
}

func TestVariableFolderScope(t *testing.T) {
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID), variableFolderScope(""))
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"), variableFolderScope("folder-a"))
}
