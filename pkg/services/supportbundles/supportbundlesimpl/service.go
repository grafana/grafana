package supportbundlesimpl

import (
	"context"
	"fmt"
	"time"

	grafanaApi "github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cleanUpInterval       = 24 * time.Hour
	bundleCreationTimeout = 20 * time.Minute
)

type Service struct {
	accessControl  ac.AccessControl
	bundleRegistry *bundleregistry.Service
	cfg            *setting.Cfg
	features       *featuremgmt.FeatureManager
	pluginSettings pluginsettings.Service
	pluginStore    plugins.Store
	store          bundleStore

	log                  log.Logger
	encryptionPublicKeys []string

	enabled         bool
	serverAdminOnly bool
}

func ProvideService(
	accessControl ac.AccessControl,
	accesscontrolService ac.Service,
	bundleRegistry *bundleregistry.Service,
	cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	httpServer *grafanaApi.HTTPServer,
	kvStore kvstore.KVStore,
	pluginSettings pluginsettings.Service,
	pluginStore plugins.Store,
	routeRegister routing.RouteRegister,
	settings setting.Provider,
	sql db.DB,
	usageStats usagestats.Service) (*Service, error) {
	section := cfg.SectionWithEnvOverrides("support_bundles")
	s := &Service{
		accessControl:        accessControl,
		bundleRegistry:       bundleRegistry,
		cfg:                  cfg,
		enabled:              section.Key("enabled").MustBool(true),
		encryptionPublicKeys: section.Key("public_keys").Strings(" "),
		features:             features,
		log:                  log.New("supportbundle.service"),
		pluginSettings:       pluginSettings,
		pluginStore:          pluginStore,
		serverAdminOnly:      section.Key("server_admin_only").MustBool(true),
		store:                newStore(kvStore),
	}

	usageStats.RegisterMetricsFunc(s.getUsageStats)

	if !s.enabled {
		return s, nil
	}

	if !accessControl.IsDisabled() {
		if err := s.declareFixedRoles(accesscontrolService); err != nil {
			return nil, err
		}
	}

	s.registerAPIEndpoints(httpServer, routeRegister)

	// TODO: move to relevant services
	s.bundleRegistry.RegisterSupportItemCollector(basicCollector(cfg))
	s.bundleRegistry.RegisterSupportItemCollector(settingsCollector(settings))
	s.bundleRegistry.RegisterSupportItemCollector(dbCollector(sql))
	s.bundleRegistry.RegisterSupportItemCollector(pluginInfoCollector(pluginStore, pluginSettings, s.log))

	return s, nil
}

func (s *Service) Run(ctx context.Context) error {
	if !s.enabled {
		return nil
	}

	ticker := time.NewTicker(cleanUpInterval)
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

func (s *Service) create(ctx context.Context, collectors []string, usr *user.SignedInUser) (*supportbundles.Bundle, error) {
	bundle, err := s.store.Create(ctx, usr)
	if err != nil {
		return nil, err
	}

	go func(uid string, collectors []string) {
		ctx, cancel := context.WithTimeout(context.Background(), bundleCreationTimeout)
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("support bundle collection panic", "err", err)
			}
			cancel()
		}()

		s.startBundleWork(ctx, collectors, uid)
	}(bundle.UID, collectors)

	return bundle, nil
}

func (s *Service) get(ctx context.Context, uid string) (*supportbundles.Bundle, error) {
	return s.store.Get(ctx, uid)
}

func (s *Service) list(ctx context.Context) ([]supportbundles.Bundle, error) {
	return s.store.List()
}

func (s *Service) remove(ctx context.Context, uid string) error {
	// Remove the data
	bundle, err := s.store.Get(ctx, uid)
	if err != nil {
		return fmt.Errorf("could not retrieve support bundle with UID %s: %w", uid, err)
	}

	// TODO handle cases when bundles aren't complete yet
	if bundle.State == supportbundles.StatePending {
		return fmt.Errorf("could not remove a support bundle with uid %s as it is still being created", uid)
	}

	// Remove the KV store entry
	return s.store.Remove(ctx, uid)
}

func (s *Service) cleanup(ctx context.Context) {
	bundles, err := s.list(ctx)
	if err != nil {
		s.log.Error("failed to list bundles to clean up", "error", err)
	}

	if err == nil {
		for _, b := range bundles {
			if time.Now().Unix() >= b.ExpiresAt {
				if err := s.remove(ctx, b.UID); err != nil {
					s.log.Error("failed to cleanup bundle", "error", err)
				}
			}
		}
	}
}

func (s *Service) getUsageStats(ctx context.Context) (map[string]interface{}, error) {
	m := map[string]interface{}{}

	count, err := s.store.StatsCount(ctx)
	if err != nil {
		s.log.Warn("unable to get support bundle counter", "error", err)
	}

	m["stats.bundles.count"] = count
	return m, nil
}
