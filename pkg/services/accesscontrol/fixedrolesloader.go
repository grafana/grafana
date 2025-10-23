package accesscontrol

import (
	"context"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const FixedRolesLoaderServiceName = "accesscontrol.fixedrolesloader"

type FixedRolesLoader struct {
	services.NamedService

	roleRegistry RoleRegistry
	features     featuremgmt.FeatureToggles
	log          log.Logger
}

func ProvideFixedRolesLoader(roleRegistry RoleRegistry, features featuremgmt.FeatureToggles) *FixedRolesLoader {
	loader := &FixedRolesLoader{
		roleRegistry: roleRegistry,
		features:     features,
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
	//nolint:staticcheck // using deprecated FFS service for backward compatibility
	return !l.features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading)
}

func (l *FixedRolesLoader) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
}
