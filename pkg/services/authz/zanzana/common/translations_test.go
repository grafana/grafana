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
		group, resource, verb := TranslateActionToListParams("dashboards:read")
		require.Equal(t, expectedGroup, group)
		require.Equal(t, expectedResource, resource)
		require.Equal(t, "get", verb)
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
