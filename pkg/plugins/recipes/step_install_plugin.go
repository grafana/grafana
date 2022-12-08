package recipes

import (
	"errors"
	"runtime"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

type installPlugin struct {
	Id      string `json:"id"`
	Version string `json:"version"`
}
type installPluginSettings struct {
	Plugin *installPlugin `json:"plugin"`
}

func newPluginInstallStep(installer plugins.Installer, cfg *setting.Cfg, store plugins.Store, meta RecipeStepMeta, plugin *installPlugin) *installPluginRecipeStep {
	// TODO: add logic to check for version missmatch between installed plugin and plugin required by recipe.
	return &installPluginRecipeStep{
		Action: "install-plugin",
		Meta:   meta,
		Settings: &installPluginSettings{
			Plugin: plugin,
		},
		installer: installer,
		cfg:       cfg,
		store:     store,
	}
}

type installPluginRecipeStep struct {
	Action    string                 `json:"action"`
	Meta      RecipeStepMeta         `json:"meta"`
	Settings  *installPluginSettings `json:"plugin"`
	installer plugins.Installer
	cfg       *setting.Cfg
	store     plugins.Store
}

func (s *installPluginRecipeStep) Apply(c *models.ReqContext) error {
	status, err := s.Status(c)
	if err != nil {
		return err
	}
	if status == Completed {
		return nil
	}

	p := s.Settings.Plugin
	err = s.installer.Add(c.Req.Context(), p.Id, p.Version, plugins.CompatOpts{
		GrafanaVersion: s.cfg.BuildVersion,
		OS:             runtime.GOOS,
		Arch:           runtime.GOARCH,
	})

	if err == nil {
		return nil
	}

	var dupeErr plugins.DuplicateError
	if errors.As(err, &dupeErr) {
		// plugin already exists
		return nil
	}

	var versionUnsupportedErr repo.ErrVersionUnsupported
	if errors.As(err, &versionUnsupportedErr) {
		return versionUnsupportedErr
	}

	var versionNotFoundErr repo.ErrVersionNotFound
	if errors.As(err, &versionNotFoundErr) {
		return versionNotFoundErr
	}

	var clientError repo.Response4xxError
	if errors.As(err, &clientError) {
		return clientError
	}

	return err
}

func (s *installPluginRecipeStep) Revert(c *models.ReqContext) error {
	status, err := s.Status(c)
	if err != nil {
		return err
	}
	if status != Completed {
		return nil
	}

	p := s.Settings.Plugin
	err = s.installer.Remove(c.Req.Context(), p.Id)

	if err == nil {
		return nil
	}

	if errors.Is(err, plugins.ErrPluginNotInstalled) {
		return nil
	}

	if errors.Is(err, plugins.ErrUninstallCorePlugin) {
		return nil
	}

	if errors.Is(err, storage.ErrUninstallOutsideOfPluginDir) {
		return nil
	}

	return err
}

func (s *installPluginRecipeStep) Status(c *models.ReqContext) (StepStatus, error) {
	if _, exists := s.store.Plugin(c.Req.Context(), s.Settings.Plugin.Id); exists {
		return Completed, nil
	}
	return NotCompleted, nil
}

func (s *installPluginRecipeStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
