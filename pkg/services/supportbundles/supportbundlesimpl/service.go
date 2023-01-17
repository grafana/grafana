package supportbundlesimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cleanUpInterval       = 24 * time.Hour
	bundleCreationTimeout = 20 * time.Minute
)

type Service struct {
	cfg            *setting.Cfg
	store          bundleStore
	pluginStore    plugins.Store
	pluginSettings pluginsettings.Service
	accessControl  ac.AccessControl
	features       *featuremgmt.FeatureManager

	log log.Logger

	collectors map[string]supportbundles.Collector
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
	features *featuremgmt.FeatureManager,
	usageStats usagestats.Service) (*Service, error) {
	s := &Service{
		cfg:            cfg,
		store:          newStore(kvStore),
		pluginStore:    pluginStore,
		pluginSettings: pluginSettings,
		accessControl:  accessControl,
		features:       features,
		log:            log.New("supportbundle.service"),
		collectors:     make(map[string]supportbundles.Collector),
	}

	if !features.IsEnabled(featuremgmt.FlagSupportBundles) {
		return s, nil
	}

	if !accessControl.IsDisabled() {
		if err := declareFixedRoles(accesscontrolService); err != nil {
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

func (s *Service) RegisterSupportItemCollector(collector supportbundles.Collector) {
	if _, ok := s.collectors[collector.UID]; ok {
		s.log.Warn("Support bundle collector with the same UID already registered", "uid", collector.UID)
	}

	s.collectors[collector.UID] = collector
}

func (s *Service) Run(ctx context.Context) error {
	if !s.features.IsEnabled(featuremgmt.FlagSupportBundles) {
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
