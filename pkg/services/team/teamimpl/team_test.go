package teamimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
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

type membershipsByUIDStore struct {
	store
	rows  []*team.TeamMemberDTO
	calls []string
}

func (s *membershipsByUIDStore) GetMembershipsByUserUID(_ context.Context, orgID int64, userUID string, external bool) ([]*team.TeamMemberDTO, error) {
	s.calls = append(s.calls, fmt.Sprintf("%d/%s/%t", orgID, userUID, external))
	return s.rows, nil
}

func TestGetUserTeamMembershipsByUIDRouting(t *testing.T) {
	client := newStackRedirectClient(t)
	errK8s := errors.New("k8s unavailable")
	k8sMemberships := []team.UserTeamMembership{{TeamID: 1, TeamUID: "k8s-team", External: true}}

	tests := []struct {
		name         string
		targetingKey string
		k8sErr       error
		want         []team.UserTeamMembership
		wantErr      error
		wantLegacy   bool
	}{
		{
			name:         "redirect reads through k8s without the users API",
			targetingKey: "enabled",
			want:         k8sMemberships,
		},
		{
			name:         "redirect returns k8s errors instead of reading legacy SQL",
			targetingKey: "enabled",
			k8sErr:       errK8s,
			wantErr:      errK8s,
		},
		{
			name:         "reads legacy SQL without the redirect",
			targetingKey: "disabled",
			want:         []team.UserTeamMembership{{TeamID: 7, TeamUID: "legacy-team", External: true, Permission: team.PermissionTypeAdmin}},
			wantLegacy:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacyStore := &membershipsByUIDStore{rows: []*team.TeamMemberDTO{
				{TeamID: 7, TeamUID: "legacy-team", UserUID: "user-1", Login: "ignored", External: true, Permission: team.PermissionTypeAdmin},
			}}
			service := &Service{
				openFeatureClient: client,
				iamFeatures:       iamapi.Features{},
				k8sService:        &teamtest.FakeService{ExpectedMemberships: k8sMemberships, ExpectedError: tt.k8sErr},
				legacyService:     &LegacyService{store: legacyStore, tracer: tracing.InitializeTracerForTest()},
			}
			ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext(tt.targetingKey, nil))

			got, err := service.GetUserTeamMembershipsByUID(ctx, &team.GetUserTeamMembershipsByUIDQuery{OrgID: 2, UserUID: "user-1", External: true})
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.want, got)
			}
			if tt.wantLegacy {
				require.Equal(t, []string{"2/user-1/true"}, legacyStore.calls)
			} else {
				require.Empty(t, legacyStore.calls)
			}
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
