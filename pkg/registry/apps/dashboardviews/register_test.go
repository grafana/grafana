package dashboardviews

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestGetAuthorizer(t *testing.T) {
	resourceReq := authorizer.AttributesRecord{ResourceRequest: true, Verb: "list", Resource: "saveddashboardviews"}
	nonResourceReq := authorizer.AttributesRecord{ResourceRequest: false, Path: "/apis"}

	tests := []struct {
		name     string
		enabled  bool
		attr     authorizer.Attributes
		expected authorizer.Decision
	}{
		{name: "flag off denies resource requests", enabled: false, attr: resourceReq, expected: authorizer.DecisionDeny},
		{name: "flag on allows resource requests", enabled: true, attr: resourceReq, expected: authorizer.DecisionAllow},
		{name: "non-resource requests have no opinion", enabled: false, attr: nonResourceReq, expected: authorizer.DecisionNoOpinion},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setSavedDashboardViewsFlag(t, tt.enabled)
			decision, _, err := (&AppInstaller{}).GetAuthorizer().Authorize(context.Background(), tt.attr)
			require.NoError(t, err)
			require.Equal(t, tt.expected, decision)
		})
	}
}

func setSavedDashboardViewsFlag(t *testing.T, enabled bool) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaSavedDashboardViews: {
			Key: featuremgmt.FlagGrafanaSavedDashboardViews, DefaultVariant: "v",
			Variants: map[string]any{"v": enabled},
		},
	})))
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })
}
