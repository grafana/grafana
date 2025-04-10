package plugincheck

import (
	"context"
	"fmt"
	sysruntime "runtime"
	"slices"

	"github.com/Masterminds/semver/v3"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
)

const (
	CheckID           = "plugin"
	DeprecationStepID = "deprecation"
	UpdateStepID      = "update"
)

func New(
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	pluginPreinstall plugininstaller.Preinstall,
	managedPlugins managedplugins.Manager,
	provisionedPlugins provisionedplugins.Manager,
) checks.Check {
	return &check{
		PluginStore:        pluginStore,
		PluginRepo:         pluginRepo,
		PluginPreinstall:   pluginPreinstall,
		ManagedPlugins:     managedPlugins,
		ProvisionedPlugins: provisionedPlugins,
	}
}

type check struct {
	PluginStore        pluginstore.Store
	PluginRepo         repo.Service
	PluginPreinstall   plugininstaller.Preinstall
	ManagedPlugins     managedplugins.Manager
	ProvisionedPlugins provisionedplugins.Manager
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	ps := c.PluginStore.Plugins(ctx)
	res := make([]any, len(ps))
	for i, p := range ps {
		res[i] = p
	}
	return res, nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&deprecationStep{
			PluginRepo: c.PluginRepo,
		},
		&updateStep{
			PluginRepo:         c.PluginRepo,
			PluginPreinstall:   c.PluginPreinstall,
			ManagedPlugins:     c.ManagedPlugins,
			ProvisionedPlugins: c.ProvisionedPlugins,
			log:                log.New("advisor.check.plugin.update"),
		},
	}
}

type deprecationStep struct {
	PluginRepo repo.Service
}

func (s *deprecationStep) Title() string {
	return "Deprecation check"
}

func (s *deprecationStep) Description() string {
	return "Check if any installed plugins are deprecated."
}

func (s *deprecationStep) Resolution() string {
	return "Check the <a href='https://grafana.com/legal/plugin-deprecation/#a-plugin-i-use-is-deprecated-what-should-i-do'" +
		"target=_blank>documentation</a> for recommended steps or delete the plugin."
}

func (s *deprecationStep) ID() string {
	return DeprecationStepID
}

func (s *deprecationStep) Run(ctx context.Context, _ *advisor.CheckSpec, it any) (*advisor.CheckReportFailure, error) {
	p, ok := it.(pluginstore.Plugin)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}

	// Skip if it's a core plugin
	if p.IsCorePlugin() {
		return nil, nil
	}

	// Check if plugin is deprecated
	i, err := s.PluginRepo.PluginInfo(ctx, p.ID)
	if err != nil {
		// Unable to check deprecation status
		return nil, nil
	}
	if i.Status == "deprecated" {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			p.ID,
			[]advisor.CheckErrorLink{
				{
					Message: "Admin",
					Url:     fmt.Sprintf("/plugins/%s", p.ID),
				},
			},
		), nil
	}
	return nil, nil
}

type updateStep struct {
	PluginRepo         repo.Service
	PluginPreinstall   plugininstaller.Preinstall
	ManagedPlugins     managedplugins.Manager
	ProvisionedPlugins provisionedplugins.Manager
	provisionedPlugins []string
	log                log.Logger
}

func (s *updateStep) Title() string {
	return "Update check"
}

func (s *updateStep) Description() string {
	return "Checks if an installed plugins has a newer version available."
}

func (s *updateStep) Resolution() string {
	return "Go to the plugin admin page and upgrade to the latest version."
}

func (s *updateStep) ID() string {
	return UpdateStepID
}

func (s *updateStep) Run(ctx context.Context, _ *advisor.CheckSpec, i any) (*advisor.CheckReportFailure, error) {
	p, ok := i.(pluginstore.Plugin)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}

	// Skip if it's a core plugin
	if p.IsCorePlugin() {
		s.log.Debug("Skipping core plugin", "plugin", p.ID)
		return nil, nil
	}

	// Skip if it's managed or pinned
	if s.isManaged(ctx, p.ID) || s.PluginPreinstall.IsPinned(p.ID) {
		s.log.Debug("Skipping managed or pinned plugin", "plugin", p.ID)
		return nil, nil
	}

	// Skip if it's provisioned
	if s.isProvisioned(ctx, p.ID) {
		s.log.Debug("Skipping provisioned plugin", "plugin", p.ID)
		return nil, nil
	}

	// Check if plugin has a newer version available
	compatOpts := repo.NewCompatOpts(services.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH)
	info, err := s.PluginRepo.GetPluginArchiveInfo(ctx, p.ID, "", compatOpts)
	if err != nil {
		// Unable to check updates
		return nil, nil
	}
	if hasUpdate(p, info) {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			p.ID,
			[]advisor.CheckErrorLink{
				{
					Message: "Upgrade",
					Url:     fmt.Sprintf("/plugins/%s?page=version-history", p.ID),
				},
			},
		), nil
	}

	return nil, nil
}

func hasUpdate(current pluginstore.Plugin, latest *repo.PluginArchiveInfo) bool {
	// If both versions are semver-valid, compare them
	v1, err1 := semver.NewVersion(current.Info.Version)
	v2, err2 := semver.NewVersion(latest.Version)
	if err1 == nil && err2 == nil {
		return v1.LessThan(v2)
	}
	// In other case, assume that a different latest version will always be newer
	return current.Info.Version != latest.Version
}

func (s *updateStep) isManaged(ctx context.Context, pluginID string) bool {
	for _, managedPlugin := range s.ManagedPlugins.ManagedPlugins(ctx) {
		if managedPlugin == pluginID {
			return true
		}
	}
	return false
}

func (s *updateStep) isProvisioned(ctx context.Context, pluginID string) bool {
	if s.provisionedPlugins == nil {
		var err error
		s.provisionedPlugins, err = s.ProvisionedPlugins.ProvisionedPlugins(ctx)
		if err != nil {
			return false
		}
	}
	return slices.Contains(s.provisionedPlugins, pluginID)
}
