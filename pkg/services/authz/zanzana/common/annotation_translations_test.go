package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAnnotationPermissionTranslations(t *testing.T) {
	const subject = "role:basic_admin#assignee"

	relations := map[string]string{
		"annotations:read":   RelationGet,
		"annotations:create": RelationCreate,
		"annotations:write":  RelationUpdate,
		"annotations:delete": RelationDelete,
	}

	t.Run("the wildcard scope maps to the annotations group_resource", func(t *testing.T) {
		for action, relation := range relations {
			tuples, ok := TranslateToResourceTuples(subject, action, KindAnnotations, "*")
			require.True(t, ok, action)
			require.Len(t, tuples, 1)
			require.Equal(t, relation, tuples[0].Relation)
			require.Equal(t, "group_resource:annotation.grafana.app/annotations", tuples[0].Object)
		}
	})

	t.Run("dashboard and folder wildcards map to the dashboards annotations subresource", func(t *testing.T) {
		for action, relation := range relations {
			for _, kind := range []string{KindDashboards, KindFolders} {
				tuples, ok := TranslateToResourceTuples(subject, action, kind, "*")
				require.True(t, ok, "%s/%s", action, kind)
				require.Len(t, tuples, 1)
				require.Equal(t, relation, tuples[0].Relation)
				require.Equal(t, "group_resource:dashboard.grafana.app/dashboards/annotations", tuples[0].Object)
			}
		}
	})

	t.Run("a folder maps to a folder subresource tuple", func(t *testing.T) {
		tuples, ok := TranslateToResourceTuples(subject, "annotations:read", KindFolders, "folder1")
		require.True(t, ok)
		require.Len(t, tuples, 1)
		require.True(t, IsFolderResourceTuple(tuples[0]))
	})
}

func TestDashboardActionSetsGrantAnnotationRelations(t *testing.T) {
	const subject = "role:basic_editor#assignee"

	annotationRelations := func(t *testing.T, action, kind, name string) []string {
		t.Helper()
		tuples, ok := TranslateToResourceTuples(subject, action, kind, name)
		require.True(t, ok)
		out := make([]string, 0, len(tuples)-1)
		for _, tuple := range tuples[1:] {
			out = append(out, tuple.Relation)
		}
		return out
	}

	t.Run("a dashboard grant writes annotation tuples for the action set", func(t *testing.T) {
		require.Equal(t, []string{RelationGet}, annotationRelations(t, "dashboards:view", KindDashboards, "dash1"))
		for _, action := range []string{"dashboards:edit", "dashboards:admin"} {
			require.Equal(t, []string{RelationCreate, RelationGet, RelationUpdate, RelationDelete}, annotationRelations(t, action, KindDashboards, "dash1"), action)
		}
	})

	t.Run("a folder grant only adds create, the rest is inherited", func(t *testing.T) {
		require.Empty(t, annotationRelations(t, "dashboards:view", KindFolders, "folder1"))
		for _, action := range []string{"dashboards:edit", "dashboards:admin"} {
			require.Equal(t, []string{RelationSubresourceCreate}, annotationRelations(t, action, KindFolders, "folder1"), action)
		}
	})

	t.Run("the wildcard grant targets the annotations group_resource", func(t *testing.T) {
		tuples, ok := TranslateToResourceTuples(subject, "dashboards:view", KindDashboards, "*")
		require.True(t, ok)
		require.Len(t, tuples, 2)
		require.Equal(t, "group_resource:dashboard.grafana.app/dashboards/annotations", tuples[1].Object)
		require.Equal(t, RelationGet, tuples[1].Relation)
	})
}
