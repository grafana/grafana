package common

import (
	"testing"

	dashboards "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/stretchr/testify/require"
)

func TestTranslateActionToListParams_UsesDeterministicMapping(t *testing.T) {
	expectedGroup := dashboards.DashboardResourceInfo.GroupResource().Group
	expectedResource := dashboards.DashboardResourceInfo.GroupResource().Resource

	for range 20 {
		group, resource, subresource, verb := TranslateActionToListParams("dashboards:read")
		require.Equal(t, expectedGroup, group)
		require.Equal(t, expectedResource, resource)
		require.Empty(t, subresource)
		require.Equal(t, "get", verb)
	}
}

func TestTranslateActionToListParams_AnnotationsUseDashboardSubresource(t *testing.T) {
	expectedGroup := dashboards.DashboardResourceInfo.GroupResource().Group
	expectedResource := dashboards.DashboardResourceInfo.GroupResource().Resource

	cases := map[string]string{
		"annotations:read":   "get",
		"annotations:write":  "update",
		"annotations:create": "create",
		"annotations:delete": "delete",
	}
	for action, expectedVerb := range cases {
		group, resource, subresource, verb := TranslateActionToListParams(action)
		require.Equal(t, expectedGroup, group, action)
		require.Equal(t, expectedResource, resource, action)
		require.Equal(t, SubresourceAnnotations, subresource, action)
		require.Equal(t, expectedVerb, verb, action)
	}
}

func TestSupportedActions_DeterministicAndUnique(t *testing.T) {
	first := SupportedActions()
	second := SupportedActions()
	require.Equal(t, first, second)

	seen := map[string]struct{}{}
	for _, entry := range first {
		if _, ok := seen[entry.Action]; ok {
			t.Fatalf("duplicate action in supported actions: %s", entry.Action)
		}
		seen[entry.Action] = struct{}{}
		require.NotEmpty(t, entry.Group)
		require.NotEmpty(t, entry.Resource)
		require.NotEmpty(t, entry.Verb)
	}
}
