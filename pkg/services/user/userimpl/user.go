package userimpl

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
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
}

var _ user.Service = (*Service)(nil)

func ProvideService(db db.DB,
	orgService org.Service,
	cfg *setting.Cfg,
	teamService team.Service,
	cacheService *localcache.CacheService, tracer tracing.Tracer,
	quotaService quota.Service, bundleRegistry supportbundles.Service,
	configProvider apiserver.DirectRestConfigProvider) (*Service, error) {
	legacyService, err := NewLegacyService(db, orgService, cfg, teamService, cacheService, tracer, quotaService, bundleRegistry)
	if err != nil {
		return nil, err
	}

	k8sService := userk8s.NewUserK8sService(log.New("user.k8s"), cfg, configProvider, tracer)

	return &Service{
		legacyService:     legacyService,
		k8sService:        k8sService,
		openFeatureClient: openfeature.NewDefaultClient(),
	}, nil
}

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	if s.isKubernetesUserServiceEnabled(ctx) {
		return s.k8sService.Create(ctx, cmd)
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
	return s.legacyService.GetByID(ctx, cmd)
}

func (s *Service) GetByUID(ctx context.Context, cmd *user.GetUserByUIDQuery) (*user.User, error) {
	return s.legacyService.GetByUID(ctx, cmd)
}

func (s *Service) ListByIdOrUID(ctx context.Context, uids []string, ids []int64) ([]*user.User, error) {
	return s.legacyService.ListByIdOrUID(ctx, uids, ids)
}

func (s *Service) GetByLogin(ctx context.Context, cmd *user.GetUserByLoginQuery) (*user.User, error) {
	return s.legacyService.GetByLogin(ctx, cmd)
}

func (s *Service) GetByEmail(ctx context.Context, cmd *user.GetUserByEmailQuery) (*user.User, error) {
	return s.legacyService.GetByEmail(ctx, cmd)
}

func (s *Service) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return s.legacyService.Update(ctx, cmd)
}

func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return s.legacyService.UpdateLastSeenAt(ctx, cmd)
}

func (s *Service) GetSignedInUser(ctx context.Context, cmd *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return s.legacyService.GetSignedInUser(ctx, cmd)
}

func (s *Service) Search(ctx context.Context, cmd *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
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
