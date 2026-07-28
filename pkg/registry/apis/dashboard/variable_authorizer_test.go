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

func TestFolderUIDFromVariableMetadataName(t *testing.T) {
	require.Equal(t, accesscontrol.GeneralFolderUID, folderUIDFromVariableMetadataName("region"))
	require.Equal(t, "folder-a", folderUIDFromVariableMetadataName("region--folder-a"))
	require.Equal(t, "abc", folderUIDFromVariableMetadataName("my--var--abc"))
}

func TestVariableFolderScope(t *testing.T) {
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID), variableFolderScope(""))
	require.Equal(t, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"), variableFolderScope("folder-a"))
}
