package hooks

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Registry interface {
	RegisterBeforeInitHook(hook Hook)
	RegisterAfterInitHook(hook Hook)
	RegisterUnloadHook(hook Hook)
}

type Runner interface {
	// TODO: hooks: consider returning errors in those first two? They feel inconsistent against RunUnloadHooks...

	RunBeforeInitHooks(ctx context.Context, plugins []*plugins.Plugin) []*plugins.Plugin
	RunAfterInitHooks(ctx context.Context, plugins []*plugins.Plugin)
	RunUnloadHooks(ctx context.Context, plugin *plugins.Plugin) error
}

type Hook func(ctx context.Context, plugin *plugins.Plugin) error

type Service struct {
	log log.Logger

	beforeInitHooks []Hook
	afterInitHooks  []Hook
	unloadHooks     []Hook
}

func ProvideHooksService() *Service {
	return &Service{log: log.New("plugins.hooks")}
}

func (h *Service) RegisterAfterInitHook(hook Hook) {
	h.log.Debug("Registered after init hook", "hook", hook)
	h.afterInitHooks = append(h.afterInitHooks, hook)
}

func (h *Service) RegisterBeforeInitHook(hook Hook) {
	h.log.Debug("Registered before init hook", "hook", hook)
	h.beforeInitHooks = append(h.beforeInitHooks, hook)
}

func (h *Service) RegisterUnloadHook(hook Hook) {
	h.log.Debug("Registered unload hook", "hook", hook)
	h.unloadHooks = append(h.unloadHooks, hook)
}

func (h *Service) RunBeforeInitHooks(ctx context.Context, loadedPlugins []*plugins.Plugin) []*plugins.Plugin {
	h.log.Debug("Running before init hooks")

	verifiedPlugins := make([]*plugins.Plugin, 0, len(loadedPlugins))
	for _, p := range loadedPlugins {
		p := p
		var err error
		for _, hook := range h.beforeInitHooks {
			err = hook(ctx, p)
			if err != nil {
				h.log.Error("Error running before init hook", "hook", hook, "pluginId", p.ID, "err", err)
				break
			}
		}

		// An error in a before init hooks makes the plugin fail to load
		if err == nil {
			verifiedPlugins = append(verifiedPlugins, p)
		}
	}
	return verifiedPlugins
}

func (h *Service) RunAfterInitHooks(ctx context.Context, verifiedPlugins []*plugins.Plugin) {
	h.log.Debug("Running after init hooks")
	for _, p := range verifiedPlugins {
		for _, hook := range h.afterInitHooks {
			if err := hook(ctx, p); err != nil {
				h.log.Error("Error running after init hook", "hook", hook, "pluginId", p.ID, "err", err)
			}
		}
	}
}

func (h *Service) RunUnloadHooks(ctx context.Context, plugin *plugins.Plugin) error {
	h.log.Debug("Running unload hooks", "pluginID", plugin.ID)
	for _, hook := range h.unloadHooks {
		if err := hook(ctx, plugin); err != nil {
			return fmt.Errorf("run unload hook %v: %w", hook, err)
		}
	}
	return nil
}
