package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/oauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ExternalServiceRegistration implements an InitializeFunc for registering external services.
type ExternalServiceRegistration struct {
	cfg                     *config.Cfg
	externalServiceRegistry oauth.ExternalServiceRegistry
	log                     log.Logger
}

// ExternalServiceRegistrationStep returns an InitializeFunc for registering external services.
func ExternalServiceRegistrationStep(cfg *config.Cfg, externalServiceRegistry oauth.ExternalServiceRegistry) initialization.InitializeFunc {
	return newExternalServiceRegistration(cfg, externalServiceRegistry).Register
}

func newExternalServiceRegistration(cfg *config.Cfg, serviceRegistry oauth.ExternalServiceRegistry) *ExternalServiceRegistration {
	return &ExternalServiceRegistration{
		cfg:                     cfg,
		externalServiceRegistry: serviceRegistry,
		log:                     log.New("plugins.external.registration"),
	}
}

// Register registers the external service with the external service registry, if the feature is enabled.
func (r *ExternalServiceRegistration) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.ExternalServiceRegistration != nil && r.cfg.Features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
		s, err := r.externalServiceRegistry.RegisterExternalService(ctx, p.ID, p.ExternalServiceRegistration)
		if err != nil {
			r.log.Error("Could not register an external service. Initialization skipped", "pluginID", p.ID, "err", err)
			return nil, err
		}
		p.ExternalService = s
	}
	return p, nil
}

// RegisterPluginRoles implements an InitializeFunc for registering plugin roles.
type RegisterPluginRoles struct {
	log          log.Logger
	roleRegistry plugins.RoleRegistry
}

// RegisterPluginRolesStep returns a new InitializeFunc for registering plugin roles.
func RegisterPluginRolesStep(roleRegistry plugins.RoleRegistry) initialization.InitializeFunc {
	return newRegisterPluginRoles(roleRegistry).Register
}

func newRegisterPluginRoles(registry plugins.RoleRegistry) *RegisterPluginRoles {
	return &RegisterPluginRoles{
		log:          log.New("plugins.roles.registration"),
		roleRegistry: registry,
	}
}

// Register registers the plugin roles with the role registry.
func (r *RegisterPluginRoles) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); err != nil {
		r.log.Warn("Declare plugin roles failed.", "pluginID", p.ID, "err", err)
	}
	return p, nil
}

// ReportBuildMetrics reports build information for all plugins, except core and bundled plugins.
func ReportBuildMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if !p.IsCorePlugin() && !p.IsBundledPlugin() {
		metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))
	}
	return p, nil
}
