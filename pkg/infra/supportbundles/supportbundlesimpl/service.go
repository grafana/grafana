package supportbundlesimpl

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg                  *setting.Cfg
	store                *store
	pluginStore          plugins.Store
	pluginSettings       pluginsettings.Service
	accessControl        ac.AccessControl
	accesscontrolService ac.Service

	log log.Logger

	collectors []supportbundles.Collector
}

func ProvideService(cfg *setting.Cfg,
	sql db.DB,
	kvStore kvstore.KVStore,
	accessControl ac.AccessControl,
	accesscontrolService ac.Service,
	routeRegister routing.RouteRegister,
	userService user.Service,
	settings setting.Provider,
	pluginStore plugins.Store,
	pluginSettings pluginsettings.Service,
	usageStats usagestats.Service) (*Service, error) {
	s := &Service{
		cfg:            cfg,
		store:          newStore(kvStore),
		pluginStore:    pluginStore,
		pluginSettings: pluginSettings,
		accessControl:  accessControl,
		log:            log.New("supportbundle.service"),
	}

	if !accessControl.IsDisabled() {
		if err := DeclareFixedRoles(accesscontrolService); err != nil {
			return nil, err
		}
	}

	s.registerAPIEndpoints(routeRegister)

	// TODO: move to relevant services
	s.RegisterSupportItemCollector(basicCollector(cfg))
	s.RegisterSupportItemCollector(settingsCollector(settings))
	s.RegisterSupportItemCollector(usageStatesCollector(usageStats))
	s.RegisterSupportItemCollector(userCollector(userService))
	s.RegisterSupportItemCollector(dbCollector(sql))
	s.RegisterSupportItemCollector(pluginInfoCollector(pluginStore, pluginSettings))

	return s, nil
}

func (s *Service) Create(ctx context.Context, collectors []string, usr *user.SignedInUser) (*supportbundles.Bundle, error) {
	bundle, err := s.store.Create(ctx, usr)
	if err != nil {
		return nil, err
	}

	go func(uid string, collectors []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()
		s.startBundleWork(ctx, collectors, uid)
	}(bundle.UID, collectors)

	return bundle, nil
}

func (s *Service) Get(ctx context.Context, uid string) (*supportbundles.Bundle, error) {
	return s.store.Get(ctx, uid)
}

func (s *Service) List(ctx context.Context) ([]supportbundles.Bundle, error) {
	return s.store.List()
}

func (s *Service) Remove(ctx context.Context, uid string) error {
	// Remove the data
	bundle, err := s.store.Get(ctx, uid)
	if err != nil {
		return fmt.Errorf("could not retrieve support bundle with uid %s: %w", uid, err)
	}

	// TODO handle cases when bundles aren't complete yet
	if bundle.State == supportbundles.StatePending {
		return fmt.Errorf("could not remove a support bundle with uid %s as it is still beign cteated", uid)
	}

	if bundle.FilePath != "" {
		if err := os.RemoveAll(filepath.Dir(bundle.FilePath)); err != nil {
			return fmt.Errorf("could not remove directory for support bundle %s: %w", uid, err)
		}
	}

	// Remove the KV store entry
	return s.store.Remove(ctx, uid)
}

func (s *Service) RegisterSupportItemCollector(collector supportbundles.Collector) {
	s.collectors = append(s.collectors, collector)
}

func (s *Service) Run(ctx context.Context) error {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	s.cleanup(ctx)
	select {
	case <-ticker.C:
		s.cleanup(ctx)
	case <-ctx.Done():
		break
	}
	return ctx.Err()
}

func (s *Service) cleanup(ctx context.Context) {
	bundles, err := s.List(ctx)
	if err != nil {
		s.log.Error("failed to list bundles to clean up", "error", err)
	}

	if err == nil {
		for _, b := range bundles {
			if time.Now().Unix() >= b.ExpiresAt {
				if err := s.Remove(ctx, b.UID); err != nil {
					s.log.Error("failed to cleanup bundle", "error", err)
				}
			}
		}
	}
}
