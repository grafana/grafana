package teamimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestIsK8sRedirectEnabledUsesResolvedStartupFeatures(t *testing.T) {
	client := newStackRedirectClient(t)

	tests := []struct {
		name         string
		features     iamapi.Features
		targetingKey string
		want         bool
	}{
		{
			name:         "enabled for a stack when users API is available",
			features:     iamapi.Features{UsersAPI: true},
			targetingKey: "enabled",
			want:         true,
		},
		{
			name:         "disabled for a stack by the runtime toggle",
			features:     iamapi.Features{UsersAPI: true},
			targetingKey: "disabled",
			want:         false,
		},
		{
			name:         "disabled when users API is unavailable",
			features:     iamapi.Features{},
			targetingKey: "enabled",
			want:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &Service{
				openFeatureClient: client,
				iamFeatures:       tt.features,
			}
			ctx := openfeature.WithTransactionContext(
				context.Background(),
				openfeature.NewEvaluationContext(tt.targetingKey, nil),
			)
			require.Equal(t, tt.want, service.isK8sRedirectEnabled(ctx))
		})
	}
}

type stackRedirectProvider struct {
	openfeature.NoopProvider
}

func (stackRedirectProvider) BooleanEvaluation(_ context.Context, flag string, defaultValue bool, evalCtx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	if flag != featuremgmt.FlagKubernetesTeamsRedirect {
		return openfeature.BoolResolutionDetail{Value: defaultValue}
	}
	return openfeature.BoolResolutionDetail{Value: evalCtx[openfeature.TargetingKey] == "enabled"}
}

func newStackRedirectClient(t *testing.T) *openfeature.Client {
	t.Helper()
	domain := t.Name()
	require.NoError(t, openfeature.SetNamedProviderAndWait(domain, stackRedirectProvider{}))
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetNamedProviderAndWait(domain, openfeature.NoopProvider{}))
	})
	return openfeature.NewClient(domain)
}
