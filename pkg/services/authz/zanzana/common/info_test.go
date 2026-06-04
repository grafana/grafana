package common

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestNewResourceInfoFromCheck_FolderCreateUnderParentUsesParentForPermissionTarget(t *testing.T) {
	parentUID := "dfjngc949fr40e"
	r := &authzv1.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     folders.FolderResourceInfo.GroupResource().Group,
		Resource:  folders.FolderResourceInfo.GroupResource().Resource,
		Namespace: "default",
		Name:      "",
		Folder:    parentUID,
	}
	info := NewResourceInfoFromCheck(r)
	require.Equal(t, parentUID, info.name)
	require.Empty(t, info.folder)
	require.Equal(t, NewTypedIdent(TypeFolder, parentUID), info.ResourceIdent())
}

func TestNewResourceInfoFromCheck_FolderCreateAtRootUsesGeneral(t *testing.T) {
	r := &authzv1.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     folders.FolderResourceInfo.GroupResource().Group,
		Resource:  folders.FolderResourceInfo.GroupResource().Resource,
		Namespace: "default",
		Name:      "",
		Folder:    "",
	}
	info := NewResourceInfoFromCheck(r)
	require.Equal(t, accesscontrol.GeneralFolderUID, info.name)
	require.Equal(t, NewTypedIdent(TypeFolder, accesscontrol.GeneralFolderUID), info.ResourceIdent())
}

func TestWildcardGroupResourceIdents_Datasources(t *testing.T) {
	t.Run("per-plugin datasource group also checks the canonical object", func(t *testing.T) {
		r := NewResourceInfoFromCheck(&authzv1.CheckRequest{
			Group:    "loki.datasource.grafana.app",
			Resource: "datasources",
			Name:     "loki-ds",
		})
		// Wildcard tier checks the per-plugin object first, then the canonical one.
		require.Equal(t, []string{
			"group_resource:loki.datasource.grafana.app/datasources",
			"group_resource:datasource.grafana.app/datasources",
		}, r.WildcardGroupResourceIdents())
		// GroupResourceIdent and the instance tier keep the per-plugin group.
		require.Equal(t, "group_resource:loki.datasource.grafana.app/datasources", r.GroupResourceIdent())
		require.Equal(t, "resource:loki.datasource.grafana.app/datasources/loki-ds", r.ResourceIdent())
	})

	t.Run("query subresource fans out to per-plugin and canonical, keeping the subresource", func(t *testing.T) {
		r := NewResourceInfoFromCheck(&authzv1.CheckRequest{
			Group:       "prometheus.datasource.grafana.app",
			Resource:    "datasources",
			Subresource: "query",
		})
		require.Equal(t, []string{
			"group_resource:prometheus.datasource.grafana.app/datasources/query",
			"group_resource:datasource.grafana.app/datasources/query",
		}, r.WildcardGroupResourceIdents())
	})

	t.Run("non-datasource and canonical groups yield a single object", func(t *testing.T) {
		dash := NewResourceInfoFromCheck(&authzv1.CheckRequest{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
		})
		require.Equal(t, []string{"group_resource:dashboard.grafana.app/dashboards"}, dash.WildcardGroupResourceIdents())

		canonical := NewResourceInfoFromCheck(&authzv1.CheckRequest{
			Group:    "datasource.grafana.app",
			Resource: "datasources",
		})
		require.Equal(t, []string{"group_resource:datasource.grafana.app/datasources"}, canonical.WildcardGroupResourceIdents())
	})

	t.Run("canonicalDatasourceGroup leaves non-plugin groups unchanged", func(t *testing.T) {
		require.Equal(t, "datasource.grafana.app", canonicalDatasourceGroup("datasource.grafana.app"))
		require.Equal(t, "datasource.grafana.app", canonicalDatasourceGroup("loki.datasource.grafana.app"))
		require.Equal(t, "dashboard.grafana.app", canonicalDatasourceGroup("dashboard.grafana.app"))
		// Nested prefixes (more than one segment) are not treated as datasource plugins.
		require.Equal(t, "a.b.datasource.grafana.app", canonicalDatasourceGroup("a.b.datasource.grafana.app"))
		// The wildcard registry key itself must never collapse.
		require.Equal(t, "*.datasource.grafana.app", canonicalDatasourceGroup("*.datasource.grafana.app"))
	})
}
