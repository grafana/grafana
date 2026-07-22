package accesscontrol

import (
	"context"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const FixedRolesLoaderServiceName = "accesscontrol.fixedrolesloader"

// SeedRolesViaLoader reports whether fixed-role seeding must run in the
// FixedRolesLoader background service instead of during Server.Init.
// The loader is ordered after declare-only role sources (plugin app installers,
// the enterprise IAM roles syncer), so it must own seeding whenever any of
// those sources is active. Server.Init and FixedRolesLoader.IsDisabled must
// both use this predicate so exactly one seeding path runs per startup.
func SeedRolesViaLoader(features featuremgmt.FeatureToggles, cfg *setting.Cfg) bool {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading) {
		return true
	}

	// Mirrors the enterprise iamrolessyncer configuration: when the IAM roles
	// syncer is enabled, seeding must wait for its role declarations,
	// otherwise IAM roles are declared after the seeding pass and are never
	// persisted.
	if cfg != nil && cfg.Raw != nil {
		return cfg.Raw.Section("rbac.iam_client").Key("enabled").MustBool(false)
	}

	return false
}

type FixedRolesLoader struct {
	services.NamedService

	roleRegistry RoleRegistry
	features     featuremgmt.FeatureToggles
	cfg          *setting.Cfg
	log          log.Logger
}

func ProvideFixedRolesLoader(cfg *setting.Cfg, roleRegistry RoleRegistry, features featuremgmt.FeatureToggles) *FixedRolesLoader {
	loader := &FixedRolesLoader{
		roleRegistry: roleRegistry,
		features:     features,
		cfg:          cfg,
		log:          log.New(FixedRolesLoaderServiceName),
	}

	loader.NamedService = services.NewBasicService(loader.starting, loader.running, nil).WithName(FixedRolesLoaderServiceName)
	return loader
}

func (l *FixedRolesLoader) starting(ctx context.Context) error {
	ctxLogger := l.log.FromContext(ctx)

	ctxLogger.Debug("Registering fixed roles")
	if err := l.roleRegistry.RegisterFixedRoles(ctx); err != nil {
		ctxLogger.Error("Failed to register fixed roles", "error", err)
		return err
	}

	return nil
}

func (l *FixedRolesLoader) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (l *FixedRolesLoader) IsDisabled() bool {
	return !SeedRolesViaLoader(l.features, l.cfg)
}

func (l *FixedRolesLoader) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
