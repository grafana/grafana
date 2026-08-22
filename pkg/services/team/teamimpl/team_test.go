package teamimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestIsK8sRedirectEnabledUsesTeamNamespace(t *testing.T) {
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	})

	testCases := []struct {
		name             string
		ctx              context.Context
		featureNamespace string
		wantNamespace    string
	}{
		{
			name:             "uses configured namespace for background calls",
			ctx:              t.Context(),
			featureNamespace: "stacks-configured",
			wantNamespace:    "stacks-configured",
		},
		{
			name: "uses request namespace when present",
			ctx: openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext("stacks-request", map[string]any{
				"namespace": "stacks-request",
			})),
			featureNamespace: "stacks-configured",
			wantNamespace:    "stacks-request",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			namespaceEvaluator := func(_ memprovider.InMemoryFlag, flatCtx openfeature.FlattenedContext) (any, openfeature.ProviderResolutionDetail) {
				return flatCtx[openfeature.TargetingKey] == tc.wantNamespace && flatCtx["namespace"] == tc.wantNamespace,
					openfeature.ProviderResolutionDetail{}
			}
			provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagKubernetesTeamsApi:      namespaceFlag(featuremgmt.FlagKubernetesTeamsApi, &namespaceEvaluator),
				featuremgmt.FlagKubernetesTeamsRedirect: namespaceFlag(featuremgmt.FlagKubernetesTeamsRedirect, &namespaceEvaluator),
				featuremgmt.FlagKubernetesUsersApi:      namespaceFlag(featuremgmt.FlagKubernetesUsersApi, &namespaceEvaluator),
			})
			require.NoError(t, openfeature.SetProviderAndWait(provider))

			svc := &Service{
				openFeatureClient: openfeature.NewDefaultClient(),
				featureNamespace:  tc.featureNamespace,
			}
			enabled, err := svc.isK8sRedirectEnabled(tc.ctx)
			require.NoError(t, err)
			require.True(t, enabled)
		})
	}

	t.Run("rejects a service without a request or configured namespace", func(t *testing.T) {
		svc := &Service{openFeatureClient: openfeature.NewDefaultClient()}
		enabled, err := svc.isK8sRedirectEnabled(t.Context())
		require.EqualError(t, err, "evaluate Team k8s redirect: namespace is required to evaluate the Team k8s redirect")
		require.False(t, enabled)
	})
}

func namespaceFlag(name string, evaluator memprovider.ContextEvaluator) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:              name,
		DefaultVariant:   "default",
		Variants:         map[string]any{"default": false},
		ContextEvaluator: evaluator,
	}
}
