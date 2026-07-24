package pipeline

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"slices"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/externaloverrides"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

// ExternalServiceRegistration implements an InitializeFunc for registering external services.
type ExternalServiceRegistration struct {
	cfg                     *config.PluginManagementCfg
	externalServiceRegistry auth.ExternalServiceRegistry
	log                     log.Logger
	tracer                  tracing.Tracer
}

// ExternalServiceRegistrationStep returns an InitializeFunc for registering external services.
func ExternalServiceRegistrationStep(cfg *config.PluginManagementCfg, externalServiceRegistry auth.ExternalServiceRegistry, tracer tracing.Tracer) initialization.InitializeFunc {
	return newExternalServiceRegistration(cfg, externalServiceRegistry, tracer).Register
}

func newExternalServiceRegistration(cfg *config.PluginManagementCfg, serviceRegistry auth.ExternalServiceRegistry, tracer tracing.Tracer) *ExternalServiceRegistration {
	return &ExternalServiceRegistration{
		cfg:                     cfg,
		externalServiceRegistry: serviceRegistry,
		log:                     log.New("plugins.external.registration"),
		tracer:                  tracer,
	}
}

// Register registers the external service with the external service registry, if the feature is enabled.
func (r *ExternalServiceRegistration) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.IAM == nil {
		return p, nil
	}

	ctx, span := r.tracer.Start(ctx, "ExternalServiceRegistration.Register")
	span.SetAttributes(attribute.String("register.pluginId", p.ID))
	defer span.End()

	ctxLogger := r.log.FromContext(ctx)

	s, err := r.externalServiceRegistry.RegisterExternalService(ctx, p.ID, string(p.Type), p.IAM)
	if err != nil {
		ctxLogger.Error("Could not register an external service. Initialization skipped", "pluginId", p.ID, "error", err)
		span.SetStatus(codes.Error, fmt.Sprintf("could not register external service: %v", err))
		return nil, err
	}
	p.ExternalService = s

	return p, nil
}

// RegisterPluginRoles implements an InitializeFunc for registering plugin roles.
type RegisterPluginRoles struct {
	log          log.Logger
	roleRegistry pluginaccesscontrol.RoleRegistry
}

// RegisterPluginRolesStep returns a new InitializeFunc for registering plugin roles.
func RegisterPluginRolesStep(roleRegistry pluginaccesscontrol.RoleRegistry) initialization.InitializeFunc {
	return newRegisterPluginRoles(roleRegistry).Register
}

func newRegisterPluginRoles(registry pluginaccesscontrol.RoleRegistry) *RegisterPluginRoles {
	return &RegisterPluginRoles{
		log:          log.New("plugins.roles.registration"),
		roleRegistry: registry,
	}
}

// Register registers the plugin roles with the role registry.
func (r *RegisterPluginRoles) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); err != nil {
		r.log.Warn("Declare plugin roles failed.", "pluginId", p.ID, "error", err)
		return nil, err
	}
	return p, nil
}

// RegisterActionSets implements an InitializeFunc for registering plugin action sets.
type RegisterActionSets struct {
	log               log.Logger
	actionSetRegistry pluginaccesscontrol.ActionSetRegistry
}

// RegisterActionSetsStep returns a new InitializeFunc for registering plugin action sets.
func RegisterActionSetsStep(actionRegistry pluginaccesscontrol.ActionSetRegistry) initialization.InitializeFunc {
	return newRegisterActionSets(actionRegistry).Register
}

func newRegisterActionSets(registry pluginaccesscontrol.ActionSetRegistry) *RegisterActionSets {
	return &RegisterActionSets{
		log:               log.New("plugins.actionsets.registration"),
		actionSetRegistry: registry,
	}
}

// Register registers the plugin action sets.
func (r *RegisterActionSets) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.actionSetRegistry.RegisterActionSets(ctx, p.ID, p.ActionSets); err != nil {
		r.log.Warn("Plugin action set registration failed", "pluginId", p.ID, "error", err)
		return nil, err
	}
	return p, nil
}

// ReportBuildMetrics reports build information for all plugins, except core plugins.
func ReportBuildMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if !p.IsCorePlugin() {
		metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))
	}

	return p, nil
}

// ReportTargetMetrics reports target information for all backend plugins.
func ReportTargetMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.Backend {
		metrics.SetPluginTargetInformation(p.ID, string(p.Target()))
	}

	return p, nil
}

// ReportFSMetrics reports plugin filesystem information for all non-core plugins.
func ReportFSMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.IsCorePlugin() {
		// No metrics for core plugins
		return p, nil
	}

	metrics.SetPluginFSInformation(p.ID, string(p.FS.Type()))
	return p, nil
}

// ReportAssetMetrics reports plugin asset information for all non-core plugins.
func ReportAssetMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.IsCorePlugin() {
		// No metrics for core plugins
		return p, nil
	}

	u, err := url.ParseRequestURI(p.BaseURL)
	if err == nil && u.Host != "" {
		metrics.SetPluginAssetInformation(p.ID, "remote")
		return p, nil
	}

	metrics.SetPluginAssetInformation(p.ID, "local")
	return p, nil
}

// ReportCloudProvisioningMetrics reports plugin cloud provisioning information for all non-core plugins.
func ReportCloudProvisioningMetrics(ppManaged provisionedplugins.Manager) initialization.InitializeFunc {
	cloudProvisioningMethod := plugins.CloudProvisioningMethodNone
	pps, err := ppManaged.ProvisionedPlugins(context.Background())
	if err != nil {
		cloudProvisioningMethod = plugins.CloudProvisioningMethodUnknown
		logger.Warn("Failed to get provisioned plugins", "error", err)
	}

	return func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
		if p.IsCorePlugin() {
			// No metrics for core plugins
			return p, nil
		}

		for _, pp := range pps {
			if pp.ID != p.ID {
				continue
			}
			if pp.URL == "" {
				cloudProvisioningMethod = plugins.CloudProvisioningMethodCatalog
			} else {
				cloudProvisioningMethod = plugins.CloudProvisioningMethodURL
			}
			metrics.SetPluginProvisioningInformation(p.ID, string(cloudProvisioningMethod))
		}

		return p, nil
	}
}

// SignatureValidation implements a ValidateFunc for validating plugin signatures.
type SignatureValidation struct {
	signatureValidator signature.Validator
	log                log.Logger
}

// SignatureValidationStep returns a new ValidateFunc for validating plugin signatures.
func SignatureValidationStep(signatureValidator signature.Validator) validation.ValidateFunc {
	sv := &SignatureValidation{
		signatureValidator: signatureValidator,
		log:                log.New("plugins.signature.validation"),
	}
	return sv.Validate
}

// Validate validates the plugin signature. If a signature error is encountered, the error is recorded with the
// pluginerrs.ErrorTracker.
func (v *SignatureValidation) Validate(ctx context.Context, p *plugins.Plugin) error {
	err := v.signatureValidator.ValidateSignature(p)
	if err != nil {
		var sigErr *plugins.Error
		if errors.As(err, &sigErr) {
			v.log.Warn("Skipping loading plugin due to problem with signature",
				"pluginId", p.ID, "status", sigErr.SignatureStatus)
			p.Error = sigErr
		}
		return err
	}

	return nil
}

// DisablePlugins is a filter step that will filter out any configured plugins
type DisablePlugins struct {
	log log.Logger
	cfg *config.PluginManagementCfg
}

// NewDisablePluginsStep returns a new DisablePlugins.
func NewDisablePluginsStep(cfg *config.PluginManagementCfg) *DisablePlugins {
	return &DisablePlugins{
		cfg: cfg,
		log: log.New("plugins.disable"),
	}
}

// Filter will filter out any plugins that are marked to be disabled.
func (c *DisablePlugins) Filter(bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	if len(c.cfg.DisablePlugins) == 0 {
		return bundles, nil
	}

	disablePluginsMap := make(map[string]bool)
	for _, pluginID := range c.cfg.DisablePlugins {
		disablePluginsMap[pluginID] = true
	}

	res := []*plugins.FoundBundle{}
	for _, bundle := range bundles {
		if disablePluginsMap[bundle.Primary.JSONData.ID] {
			c.log.Debug("Disabling plugin load", "pluginID", bundle.Primary.JSONData.ID)
		} else {
			res = append(res, bundle)
		}
	}
	return res, nil
}

// AsExternal is a filter step that will skip loading a core plugin to use an external one.
type AsExternal struct {
	log log.Logger
	cfg *config.PluginManagementCfg
}

// NewAsExternalStep returns a new DisablePlugins.
func NewAsExternalStep(cfg *config.PluginManagementCfg) *AsExternal {
	return &AsExternal{
		cfg: cfg,
		log: log.New("plugins.asExternal"),
	}
}

// Filter will filter out any plugins that are marked to be disabled.
func (c *AsExternal) Filter(cl plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	if cl == plugins.ClassCore {
		// Build a set of core plugin IDs that are in the override registry.
		// For registry plugins, suppression requires the override to be fully active
		// (both as_external and alias_ids configured) to prevent the dangerous partial-config
		// state where the core plugin is suppressed with no external replacement registered.
		// For non-registry plugins, as_external = true alone continues to work as before.
		registryIDs := make(map[string]bool, len(externaloverrides.Overrides))
		for _, o := range externaloverrides.Overrides {
			registryIDs[o.CorePluginID] = true
		}
		activeOverrideIDs := make(map[string]bool, len(c.cfg.ActiveExternalOverrides))
		for _, o := range c.cfg.ActiveExternalOverrides {
			activeOverrideIDs[o.CorePluginID] = true
		}

		res := []*plugins.FoundBundle{}
		for _, bundle := range bundles {
			pluginID := bundle.Primary.JSONData.ID
			pluginCfg := c.cfg.PluginSettings[pluginID]
			asExternal := pluginCfg["as_external"] == "true"
			// For registry plugins: require full activation to prevent partial-config suppression.
			// For non-registry plugins: as_external alone is sufficient (existing behaviour preserved).
			shouldSuppress := asExternal && (!registryIDs[pluginID] || activeOverrideIDs[pluginID])
			if shouldSuppress {
				c.log.Info("Core plugin replaced by external plugin", "pluginID", pluginID)
			} else {
				res = append(res, bundle)
			}
		}
		return res, nil
	}
	return bundles, nil
}

// ExternalPluginOverridesDecorateFunc returns a DecorateFunc that injects core plugin IDs as aliases
// into their external replacement plugins, based on the active external overrides. This ensures that
// existing dashboards and data sources continue to work without migration when a core plugin is
// replaced by an external one.
func ExternalPluginOverridesDecorateFunc(activeOverrides []config.ExternalOverride) func(context.Context, *plugins.Plugin) (*plugins.Plugin, error) {
	return func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
		for _, o := range activeOverrides {
			if p.ID == o.ExternalPluginID {
				p.AliasIDs = append(p.AliasIDs, o.CorePluginID)
			}
		}
		return p, nil
	}
}

// DuplicatePluginIDValidation is a filter step that will filter out any plugins that are already registered with the same
// plugin ID. This includes both the primary plugin and child plugins, which are matched using the plugin.json plugin
// ID field.
type DuplicatePluginIDValidation struct {
	registry registry.Service
	log      log.Logger
}

// NewDuplicatePluginIDFilterStep returns a new DuplicatePluginIDValidation.
func NewDuplicatePluginIDFilterStep(registry registry.Service) *DuplicatePluginIDValidation {
	return &DuplicatePluginIDValidation{
		registry: registry,
		log:      log.New("plugins.dedupe"),
	}
}

// Filter will filter out any plugins that have already been registered under the same plugin ID.
func (d *DuplicatePluginIDValidation) Filter(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	res := make([]*plugins.FoundBundle, 0, len(bundles))

	var matchesPluginIDFunc = func(fp plugins.FoundPlugin) func(p *plugins.Plugin) bool {
		return func(p *plugins.Plugin) bool {
			return p.ID == fp.JSONData.ID
		}
	}

	for _, b := range bundles {
		ps := d.registry.Plugins(ctx)

		if slices.ContainsFunc(ps, matchesPluginIDFunc(b.Primary)) {
			d.log.Warn("Skipping loading of plugin as it's a duplicate", "pluginId", b.Primary.JSONData.ID)
			continue
		}

		var nonDupeChildren []*plugins.FoundPlugin
		for _, child := range b.Children {
			if slices.ContainsFunc(ps, matchesPluginIDFunc(*child)) {
				d.log.Warn("Skipping loading of child plugin as it's a duplicate", "pluginId", child.JSONData.ID)
				continue
			}
			nonDupeChildren = append(nonDupeChildren, child)
		}
		res = append(res, &plugins.FoundBundle{
			Primary:  b.Primary,
			Children: nonDupeChildren,
		})
	}

	return res, nil
}
