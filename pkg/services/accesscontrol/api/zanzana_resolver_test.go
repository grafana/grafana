package api

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestListPermissions_MapsZanzanaFoldersToLegacyFolderScopes(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	require.NotEmpty(t, group)
	require.NotEmpty(t, verb)

	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Items:   []string{"some-dashboard-uid"},
			Folders: []string{"d70a877a-cf3c-4b71-9d36-9f247dc9a725", "f054cb8b-2208-4c6e-a965-c02b8dcaba0e"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:someuid",
		group,
		resource,
		verb,
		"dashboards:read",
		"",
	)
	require.NoError(t, err)

	want := []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "some-dashboard-uid")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "d70a877a-cf3c-4b71-9d36-9f247dc9a725")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "f054cb8b-2208-4c6e-a965-c02b8dcaba0e")},
	}
	require.ElementsMatch(t, want, perms)
}

func TestListPermissions_AllTrue_IncludesDashboardAndFolderWildcardsForDashboardActions(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	fake := &fakeZanzanaClient{listResp: &authzv1.ListResponse{All: true}}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:1",
		group,
		resource,
		verb,
		"dashboards:read",
		"",
	)
	require.NoError(t, err)

	require.ElementsMatch(t, []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
	}, perms)
}

func TestListPermissions_ScopeFilter_AppliesToFolderScopes(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Folders: []string{"keep-me", "drop-me"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:1",
		group,
		resource,
		verb,
		"dashboards:read",
		ac.Scope("folders", "uid", "keep-me"),
	)
	require.NoError(t, err)

	require.Equal(t, []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "keep-me")},
	}, perms)
}
