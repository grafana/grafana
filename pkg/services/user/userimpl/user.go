package userimpl

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/open-feature/go-sdk/openfeature"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userk8s"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	legacyService     user.Service
	k8sService        user.Service
	openFeatureClient *openfeature.Client
	logger            log.Logger
	tracer            tracing.Tracer
	cfg               *setting.Cfg
}

var _ user.Service = (*Service)(nil)

func ProvideService(db db.DB,
	orgService org.Service,
	cfg *setting.Cfg,
	teamService team.Service,
	cacheService *localcache.CacheService, tracer tracing.Tracer,
	quotaService quota.Service, bundleRegistry supportbundles.Service,
	clientGenerator resource.ClientGenerator) (*Service, error) {
	legacyService, err := NewLegacyService(db, orgService, cfg, teamService, cacheService, tracer, quotaService, bundleRegistry)
	if err != nil {
		return nil, err
	}

	k8sService := userk8s.NewUserK8sService(log.New("user.k8s"), cfg, clientGenerator, tracer)

	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
		logger:            log.New("user"),
		tracer:            tracer,
		cfg:               cfg,
	}, nil
}

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.Create(k8sCtx, cmd)
	}

	return s.legacyService.Create(ctx, cmd)
}

func (s *Service) CreateServiceAccount(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	return s.legacyService.CreateServiceAccount(ctx, cmd)
}

func (s *Service) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	return s.legacyService.Delete(ctx, cmd)
}

func (s *Service) GetByID(ctx context.Context, cmd *user.GetUserByIDQuery) (*user.User, error) {
	ctx, span := s.tracer.Start(ctx, "user.wrapper.GetByID", trace.WithAttributes(
		attribute.Int64("userID", cmd.ID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		result, err := s.k8sService.GetByID(k8sCtx, cmd)
		if err == nil {
			span.SetAttributes(attribute.Bool("fallback_to_legacy", false))
			return result, nil
		}
		ctxLogger.Warn("k8s GetByID failed, falling back to legacy", "userID", cmd.ID, "err", err)
	}

	span.SetAttributes(attribute.Bool("fallback_to_legacy", true))
	return s.legacyService.GetByID(ctx, cmd)
}

func (s *Service) GetByUID(ctx context.Context, cmd *user.GetUserByUIDQuery) (*user.User, error) {
	return s.legacyService.GetByUID(ctx, cmd)
}

func (s *Service) ListByIdOrUID(ctx context.Context, uids []string, ids []int64) ([]*user.User, error) {
	return s.legacyService.ListByIdOrUID(ctx, uids, ids)
}

func (s *Service) GetByLoginWithPassword(ctx context.Context, cmd *user.GetUserByLoginQuery) (*user.User, error) {
	// Redirect to legacy service as support for passwords is not implemented in the k8s service
	return s.legacyService.GetByLoginWithPassword(ctx, cmd)
}

func (s *Service) GetByLogin(ctx context.Context, cmd *user.GetUserByLoginQuery) (*user.User, error) {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.GetByLogin(k8sCtx, cmd)
	}

	return s.legacyService.GetByLogin(ctx, cmd)
}

func (s *Service) GetByEmail(ctx context.Context, cmd *user.GetUserByEmailQuery) (*user.User, error) {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.GetByEmail(k8sCtx, cmd)
	}

	return s.legacyService.GetByEmail(ctx, cmd)
}

func (s *Service) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.Update(k8sCtx, cmd)
	}

	return s.legacyService.Update(ctx, cmd)
}

func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.UpdateLastSeenAt(k8sCtx, cmd)
	}

	return s.legacyService.UpdateLastSeenAt(ctx, cmd)
}

func (s *Service) GetSignedInUser(ctx context.Context, cmd *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	ctx, span := s.tracer.Start(ctx, "user.wrapper.GetSignedInUser", trace.WithAttributes(
		attribute.Int64("userID", cmd.UserID),
		attribute.Int64("orgID", cmd.OrgID),
	))
	defer span.End()

	ctxLogger := s.logger.FromContext(ctx)

	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCmd := *cmd
		if !hasOrgID(ctx) && k8sCmd.OrgID == 0 {
			k8sCmd.OrgID = s.cfg.DefaultOrgID()
		}

		result, err := s.k8sService.GetSignedInUser(ctx, &k8sCmd)
		if err == nil {
			span.SetAttributes(attribute.Bool("fallback_to_legacy", false))
			return result, nil
		}
		ctxLogger.Warn("k8s GetSignedInUser failed, falling back to legacy", "userID", cmd.UserID, "err", err)
	}

	span.SetAttributes(attribute.Bool("fallback_to_legacy", true))
	return s.legacyService.GetSignedInUser(ctx, cmd)
}

func (s *Service) Search(ctx context.Context, cmd *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	if s.isKubernetesUserServiceEnabled(ctx) {
		k8sCtx := ctx
		if !hasOrgID(ctx) {
			k8sCtx = identity.WithOrgID(ctx, s.cfg.DefaultOrgID())
		}
		return s.k8sService.Search(k8sCtx, cmd)
	}

	return s.legacyService.Search(ctx, cmd)
}

func (s *Service) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return s.legacyService.BatchDisableUsers(ctx, cmd)
}

func (s *Service) GetProfile(ctx context.Context, cmd *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	return s.legacyService.GetProfile(ctx, cmd)
}

func (s *Service) GetUsageStats(ctx context.Context) map[string]any {
	return s.legacyService.GetUsageStats(ctx)
}

func (s *Service) isKubernetesUserServiceEnabled(ctx context.Context) bool {
	if s.openFeatureClient == nil {
		return false
	}

	return s.openFeatureClient.Boolean(ctx, featuremgmt.FlagKubernetesUsersRedirect, false, openfeature.TransactionContext(ctx))
}

func hasOrgID(ctx context.Context) bool {
	if requester, err := identity.GetRequester(ctx); err == nil {
		return requester.GetOrgID() != 0
	}

	orgID, ok := identity.OrgIDFrom(ctx)
	return ok && orgID != 0
}
