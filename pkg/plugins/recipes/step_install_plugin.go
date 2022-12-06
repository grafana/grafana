package recipes

import (
	"context"
	"errors"
	"runtime"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

type recipePluginStep struct {
	Id      string `json:"id"`
	Version string `json:"version"`
}

func newPluginInstallStep(installer plugins.Installer, cfg *setting.Cfg, meta RecipeStepMeta, plugin recipePluginStep) *installPluginRecipeStep {
	return &installPluginRecipeStep{
		Action:    "install-plugin",
		Meta:      meta,
		Plugin:    plugin,
		installer: installer,
		cfg:       cfg,
	}
}

type installPluginRecipeStep struct {
	Action    string           `json:"action"`
	Meta      RecipeStepMeta   `json:"meta"`
	Plugin    recipePluginStep `json:"plugin"`
	Status    RecipeStepStatus `json:"status"`
	installer plugins.Installer
	cfg       *setting.Cfg
}

func (s *installPluginRecipeStep) Apply(c context.Context) error {
	err := s.installer.Add(c, s.Plugin.Id, s.Plugin.Version, plugins.CompatOpts{
		GrafanaVersion: s.cfg.BuildVersion,
		OS:             runtime.GOOS,
		Arch:           runtime.GOARCH,
	})

	if err == nil {
		s.Status = RecipeStepStatus{
			Status:        "Installed",
			StatusMessage: "Plugin successfully installed",
		}
		return nil
	}

	var dupeErr plugins.DuplicateError
	if errors.As(err, &dupeErr) {
		s.Status = RecipeStepStatus{
			Status:        "Installed",
			StatusMessage: "Plugin already installed",
		}
		return nil
	}

	var versionUnsupportedErr repo.ErrVersionUnsupported
	if errors.As(err, &versionUnsupportedErr) {
		s.Status = RecipeStepStatus{
			Status:        "NotInstalled",
			StatusMessage: "Plugin version not supported",
		}
		return nil
	}

	var versionNotFoundErr repo.ErrVersionNotFound
	if errors.As(err, &versionNotFoundErr) {
		s.Status = RecipeStepStatus{
			Status:        "NotInstalled",
			StatusMessage: "Plugin version not found",
		}
		return nil
	}

	var clientError repo.Response4xxError
	if errors.As(err, &clientError) {
		s.Status = RecipeStepStatus{
			Status:        "NotInstalled",
			StatusMessage: clientError.Message,
		}
		return nil
	}

	if errors.Is(err, plugins.ErrInstallCorePlugin) {
		s.Status = RecipeStepStatus{
			Status:        "NotInstalled",
			StatusMessage: "Cannot install or change a Core plugin",
		}
		return nil
	}

	return err
}

func (s *installPluginRecipeStep) Revert(c context.Context) error {
	err := s.installer.Remove(c, s.Plugin.Id)

	if err == nil {
		s.Status = RecipeStepStatus{
			Status:        "",
			StatusMessage: "",
		}
		return nil
	}

	if errors.Is(err, plugins.ErrPluginNotInstalled) {
		s.Status = RecipeStepStatus{
			Status:        "",
			StatusMessage: "",
		}
		return nil
	}

	if errors.Is(err, plugins.ErrUninstallCorePlugin) {
		s.Status = RecipeStepStatus{

			Status:        "Installed",
			StatusMessage: "Plugin is installed (Core plugin, cannot be uninstalled)",
		}

		return nil
	}

	if errors.Is(err, storage.ErrUninstallOutsideOfPluginDir) {
		s.Status = RecipeStepStatus{
			Status:        "Installed",
			StatusMessage: "Plugin is installed (Cannot unistall the plugin due to being outside of the plugins directory)",
		}
		return nil
	}

	return err

}
