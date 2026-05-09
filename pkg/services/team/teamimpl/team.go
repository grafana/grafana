package teamimpl

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamk8s"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	legacyService     team.Service
	k8sService        team.Service
	openFeatureClient *openfeature.Client
}

var _ team.Service = (*Service)(nil)

func (s *Service) LegacySearchService() team.Service {
	return s.legacyService
}

func ProvideService(db db.DB, cfg *setting.Cfg, tracer tracing.Tracer, configProvider apiserver.DirectRestConfigProvider) (*Service, error) {
	legacyService, err := NewLegacyService(db, cfg, tracer)
	if err != nil {
		return nil, err
	}

	k8sService := teamk8s.NewTeamK8sService(log.New("team.k8s"), cfg, configProvider, tracer)

	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
	}, nil
}

func (s *Service) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.CreateTeam(ctx, cmd)
	}

	return s.legacyService.CreateTeam(ctx, cmd)
}

func (s *Service) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.UpdateTeam(ctx, cmd)
	}

	return s.legacyService.UpdateTeam(ctx, cmd)
}

func (s *Service) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.DeleteTeam(ctx, cmd)
	}

	return s.legacyService.DeleteTeam(ctx, cmd)
}

func (s *Service) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) && !s.shouldFallbackToLegacy(ctx) {
		return s.k8sService.SearchTeams(ctx, query)
	}

	return s.legacyService.SearchTeams(ctx, query)
}

func (s *Service) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) && !s.shouldFallbackToLegacy(ctx) {
		return s.k8sService.GetTeamByID(ctx, query)
	}

	return s.legacyService.GetTeamByID(ctx, query)
}

func (s *Service) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	if s.isUserTeamsK8sPathEnabled(ctx) {
		return s.k8sService.GetTeamsByUser(ctx, query)
	}

	return s.legacyService.GetTeamsByUser(ctx, query)
}

func (s *Service) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	if s.isUserTeamsK8sPathEnabled(ctx) {
		// GetTeamIDsByUser is called during authentication (e.g. middleware that
		// resolves team-based permissions) before a requester has been attached to
		// the context. The k8s service requires a requester to build the dynamic
		// client, so we must use the legacy SQL path for these pre-auth calls.
		if _, err := identity.GetRequester(ctx); err == nil {
			return s.k8sService.GetTeamIDsByUser(ctx, query)
		}
	}

	return s.legacyService.GetTeamIDsByUser(ctx, query)
}

func (s *Service) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.IsTeamMember(ctx, orgId, teamId, userId)
	}

	return s.legacyService.IsTeamMember(ctx, orgId, teamId, userId)
}

// RemoveUsersMemberships is instance-wide cleanup; the k8s service is namespace-scoped so this always routes to legacy.
func (s *Service) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return s.legacyService.RemoveUsersMemberships(ctx, userID)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	if s.isUserTeamsK8sPathEnabled(ctx) {
		return s.k8sService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
	}

	return s.legacyService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
}

func (s *Service) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	if s.isKubernetesTeamServiceEnabled(ctx) {
		return s.k8sService.GetTeamMembers(ctx, query)
	}

	return s.legacyService.GetTeamMembers(ctx, query)
}

func (s *Service) RegisterDelete(query string) {
	// Always register with legacy service since it manages SQL cleanup queries.
	// The k8s service implementation is a no-op (k8s handles cascading deletes
	// via its own mechanisms), so there is no need to gate on the feature flag.
	// This is called at init time (Wire providers) where no request context
	// exists, making feature flag evaluation with context.Background() unreliable.
	s.legacyService.RegisterDelete(query)
}

func (s *Service) isKubernetesTeamServiceEnabled(ctx context.Context) bool {
	if s.openFeatureClient == nil {
		return false
	}

	return s.openFeatureClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, openfeature.TransactionContext(ctx))
}

// isUserTeamsK8sPathEnabled gates the methods that read membership through
// the /users/{uid}/teams subresource (GetTeamsByUser, GetTeamIDsByUser,
// GetUserTeamMemberships). The subresource is gated on FlagKubernetesTeamBindings;
// without it the apiserver returns 403 and these methods would fail. Both
// flags must be on for the k8s path; otherwise we fall back to legacy.
func (s *Service) isUserTeamsK8sPathEnabled(ctx context.Context) bool {
	if !s.isKubernetesTeamServiceEnabled(ctx) {
		return false
	}
	return s.openFeatureClient.Boolean(ctx, featuremgmt.FlagKubernetesTeamBindings, false, openfeature.TransactionContext(ctx))
}

// shouldFallbackToLegacy determines whether to fallback to the legacy service for a given request.
// The main use case is for internal calls coming from the externalgroupmapping legacy search, those
// calls have a service identity and no contexthandler, so we use that as a heuristic to determine
// if we should fallback to the legacy service. This allows us to incrementally migrate the
// externalgroupmapping search to the new k8s team service without breaking existing functionality.
// We can remove this fallback once the migration is complete and all internal calls are using the new k8s team service.
func (s *Service) shouldFallbackToLegacy(ctx context.Context) bool {
	return identity.IsServiceIdentity(ctx) && contexthandler.FromContext(ctx) == nil
}
