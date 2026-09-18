package sync

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultOrgName = "Main Org."

const ensureOrgAndAdminCacheKey = "authn.ensure_org_and_admin.done"

func ProvideEnsureOrgAndAdmin(orgSvc org.Service, userSvc user.Service, cfg *setting.Cfg, cache remotecache.CacheStorage) *EnsureOrgAndAdmin {
	if cache == nil {
		cache = remotecache.NewFakeCacheStorage()
	}
	return &EnsureOrgAndAdmin{
		orgSvc:  orgSvc,
		userSvc: userSvc,
		cfg:     cfg,
		cache:   cache,
		log:     log.New("authn.ensure_org_and_admin"),
	}
}

// EnsureOrgAndAdmin ensures the default org and admin user exist before any
// external identity is synced. In the MT authn pipeline, the first SSO
// login can race sqlstore.ensureMainOrgAndAdminUser, so this hook
// guarantees the initial state is in place before SyncUserHook runs.
type EnsureOrgAndAdmin struct {
	orgSvc  org.Service
	userSvc user.Service
	cfg     *setting.Cfg
	cache   remotecache.CacheStorage
	log     log.Logger
	done    atomic.Bool
}

// Hook is a PostAuthHook that must run before SyncUserHook.
func (s *EnsureOrgAndAdmin) Hook(ctx context.Context, id *authn.Identity, _ *authn.Request) error {
	if s.done.Load() {
		return nil
	}

	if !id.ClientParams.SyncUser {
		return nil
	}

	if _, err := s.cache.Get(ctx, ensureOrgAndAdminCacheKey); err == nil {
		s.done.Store(true)
		return nil
	}

	if err := s.run(ctx); err != nil {
		return err
	}

	s.done.Store(true)
	if err := s.cache.Set(ctx, ensureOrgAndAdminCacheKey, []byte("1"), 0); err != nil {
		s.log.Warn("Failed to persist initial setup marker to remote cache", "error", err)
	}
	return nil
}

func (s *EnsureOrgAndAdmin) run(ctx context.Context) error {
	if _, err := s.userSvc.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: s.cfg.AdminUser}); err == nil {
		return nil
	}

	if _, err := s.orgSvc.GetOrCreate(ctx, defaultOrgName); err != nil {
		return fmt.Errorf("ensure default org: %w", err)
	}

	if s.cfg.DisableInitAdminCreation {
		return nil
	}

	_, err := s.userSvc.Create(ctx, &user.CreateUserCommand{
		Login:    s.cfg.AdminUser,
		Email:    s.cfg.AdminEmail,
		Password: user.Password(s.cfg.AdminPassword),
		IsAdmin:  true,
	})
	if err != nil && !errors.Is(err, user.ErrUserAlreadyExists) {
		return fmt.Errorf("ensure admin user: %w", err)
	}

	return nil
}
