package pluginassets

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

func ProvideService(calc *modulehash.Calculator) *Service {
	return &Service{
		calc: calc,
	}
}

func ProvideModuleHashCalculator(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service,
	signature *signature.Signature, reg registry.Service) *modulehash.Calculator {
	return modulehash.NewCalculator(cfg, reg, cdn, signature)
}

type Service struct {
	calc *modulehash.Calculator
}

// ModuleHash returns the module.js SHA256 hash for a plugin in the format expected by the browser for SRI checks.
func (s *Service) ModuleHash(ctx context.Context, p pluginstore.Plugin) string {
	return s.calc.ModuleHash(ctx, p.ID, p.Info.Version)
}
