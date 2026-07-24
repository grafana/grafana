package teamimpl

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamk8s"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	legacyService     team.Service
	k8sService        team.Service
	openFeatureClient *openfeature.Client
	featureNamespace  string
	logger            log.Logger
	tracer            tracing.Tracer
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
	featureNamespace := "default"
	if cfg.StackID != "" {
		featureNamespace = "stacks-" + cfg.StackID
	}

	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
		featureNamespace:  featureNamespace,
		logger:            log.New("team"),
		tracer:            tracer,
	}, nil
}

func (s *Service) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return team.Team{}, err
	}
	if redirectEnabled {
		return s.k8sService.CreateTeam(ctx, cmd)
	}

	return s.legacyService.CreateTeam(ctx, cmd)
}

func (s *Service) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return err
	}
	if redirectEnabled {
		return s.k8sService.UpdateTeam(ctx, cmd)
	}

	return s.legacyService.UpdateTeam(ctx, cmd)
}

func (s *Service) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return err
	}
	if redirectEnabled {
		return s.k8sService.DeleteTeam(ctx, cmd)
	}

	return s.legacyService.DeleteTeam(ctx, cmd)
}

func (s *Service) SearchTeams(ctx context.Context, query *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return team.SearchTeamQueryResult{}, err
	}
	if redirectEnabled && !s.shouldFallbackToLegacy(ctx) {
		return s.k8sService.SearchTeams(ctx, query)
	}

	return s.legacyService.SearchTeams(ctx, query)
}

func (s *Service) GetTeamByID(ctx context.Context, query *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if redirectEnabled && !s.shouldFallbackToLegacy(ctx) {
		return s.k8sService.GetTeamByID(ctx, query)
	}

	return s.legacyService.GetTeamByID(ctx, query)
}

func (s *Service) GetTeamsByUser(ctx context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	ctx, span := s.tracer.Start(ctx, "team.wrapper.GetTeamsByUser", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.Int64("userID", query.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if redirectEnabled {
		result, err := s.k8sService.GetTeamsByUser(ctx, query)
		if err == nil {
			span.SetAttributes(attribute.Bool("fallback_to_legacy", false))
			return result, nil
		}
		ctxLogger.Warn("k8s GetTeamsByUser failed, falling back to legacy", "userID", query.UserID, "err", err)
	}

	span.SetAttributes(attribute.Bool("fallback_to_legacy", true))
	return s.legacyService.GetTeamsByUser(ctx, query)
}

func (s *Service) GetTeamIDsByUser(ctx context.Context, query *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	ctx, span := s.tracer.Start(ctx, "team.wrapper.GetTeamIDsByUser", trace.WithAttributes(
		attribute.Int64("orgID", query.OrgID),
		attribute.Int64("userID", query.UserID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return nil, nil, err
	}

	// GetTeamIDsByUser is called during authentication (e.g. middleware that
	// resolves team-based permissions) before a requester has been attached to
	// the context. The k8s service requires a requester to build the dynamic
	// client, so skip the k8s attempt for these pre-auth calls to avoid noisy
	// per-request fallback logs.
	if redirectEnabled {
		if _, err := identity.GetRequester(ctx); err == nil {
			ids, uids, err := s.k8sService.GetTeamIDsByUser(ctx, query)
			if err == nil {
				span.SetAttributes(attribute.Bool("fallback_to_legacy", false))
				return ids, uids, nil
			}
			ctxLogger.Warn("k8s GetTeamIDsByUser failed, falling back to legacy", "userID", query.UserID, "err", err)
		}
	}

	span.SetAttributes(attribute.Bool("fallback_to_legacy", true))
	return s.legacyService.GetTeamIDsByUser(ctx, query)
}

func (s *Service) IsTeamMember(ctx context.Context, orgId int64, teamId int64, userId int64) (bool, error) {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return false, err
	}
	if redirectEnabled {
		return s.k8sService.IsTeamMember(ctx, orgId, teamId, userId)
	}

	return s.legacyService.IsTeamMember(ctx, orgId, teamId, userId)
}

// RemoveUsersMemberships is instance-wide cleanup; the k8s service is namespace-scoped so this always routes to legacy.
func (s *Service) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return s.legacyService.RemoveUsersMemberships(ctx, userID)
}

func (s *Service) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	ctx, span := s.tracer.Start(ctx, "team.wrapper.GetUserTeamMemberships", trace.WithAttributes(
		attribute.Int64("orgID", orgID),
		attribute.Int64("userID", userID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if redirectEnabled {
		result, err := s.k8sService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
		if err == nil {
			span.SetAttributes(attribute.Bool("fallback_to_legacy", false))
			return result, nil
		}
		ctxLogger.Warn("k8s GetUserTeamMemberships failed, falling back to legacy", "userID", userID, "err", err)
	}

	span.SetAttributes(attribute.Bool("fallback_to_legacy", true))
	return s.legacyService.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
}

func (s *Service) GetTeamMembers(ctx context.Context, query *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	redirectEnabled, err := s.isK8sRedirectEnabled(ctx)
	if err != nil {
		return nil, err
	}
	if redirectEnabled {
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

func (s *Service) isK8sRedirectEnabled(ctx context.Context) (bool, error) {
	namespace, _ := openfeature.TransactionContext(ctx).Attributes()["namespace"].(string)
	if namespace == "" {
		namespace = s.featureNamespace
	}

	enabled, err := team.IsK8sRedirectEnabledForNamespace(ctx, s.openFeatureClient, namespace)
	if err != nil {
		return false, fmt.Errorf("evaluate Team k8s redirect: %w", err)
	}
	return enabled, nil
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
