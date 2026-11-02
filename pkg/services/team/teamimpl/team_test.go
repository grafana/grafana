package teamimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
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

func TestIsK8sRedirectEnabledKeepsUsersAPIAtStartupAndRedirectDynamic(t *testing.T) {
	domain := t.Name()
	setProvider := func(usersAPI, teamsRedirect bool) {
		t.Helper()
		flags := map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagKubernetesUsersApi: {
				Key:            featuremgmt.FlagKubernetesUsersApi,
				DefaultVariant: "configured",
				Variants:       map[string]any{"configured": usersAPI},
			},
			featuremgmt.FlagKubernetesTeamsRedirect: {
				Key:            featuremgmt.FlagKubernetesTeamsRedirect,
				DefaultVariant: "configured",
				Variants:       map[string]any{"configured": teamsRedirect},
			},
		}
		require.NoError(t, openfeature.SetNamedProviderAndWait(domain, memprovider.NewInMemoryProvider(flags)))
	}
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetNamedProviderAndWait(domain, openfeature.NoopProvider{}))
	})

	setProvider(true, true)
	client := openfeature.NewClient(domain)
	service := &Service{
		openFeatureClient: client,
		iamFeatures:       iamapi.FeaturesFromFlags(context.Background(), client),
	}
	require.True(t, service.isK8sRedirectEnabled(context.Background()))

	// Users API availability is a startup value. A later legacy flag change does
	// not alter it, while the request-time redirect remains a live kill switch.
	setProvider(false, true)
	require.True(t, service.isK8sRedirectEnabled(context.Background()))

	setProvider(false, false)
	require.False(t, service.isK8sRedirectEnabled(context.Background()))
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
