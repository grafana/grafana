package hooks

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Registry allows to register new hooks to run at various points of a plugin's lifecycle.
type Registry interface {
	RegisterBeforeLoadHook(hook Hook)
	RegisterLoadHook(hook Hook)
	RegisterUnloadHook(hook Hook)
}

// Runner allows to run plugin hooks for a plugin.
type Runner interface {
	RunBeforeLoadHooks(ctx context.Context, plugin *plugins.Plugin) error
	RunLoadHooks(ctx context.Context, plugin *plugins.Plugin) error
	RunUnloadHooks(ctx context.Context, plugin *plugins.Plugin) error
}

// Hook is a function that can be run at various stages of a plugin's lifecycle.
type Hook func(ctx context.Context, plugin *plugins.Plugin) error

// Service implements a hooks Registry and hooks Runner.
type Service struct {
	log log.Logger

	beforeLoadHooks []Hook
	loadHooks       []Hook
	unloadHooks     []Hook
}

func ProvideHooksService() *Service {
	return &Service{log: log.New("plugins.hooks")}
}

// RegisterBeforeLoadHook appends a new before load hook.
func (h *Service) RegisterBeforeLoadHook(hook Hook) {
	h.log.Debug("Registered before load hook", "hook", hook)
	h.beforeLoadHooks = append(h.beforeLoadHooks, hook)
}

// RegisterLoadHook appends a new load hook.
func (h *Service) RegisterLoadHook(hook Hook) {
	h.log.Debug("Registered load hook", "hook", hook)
	h.loadHooks = append(h.loadHooks, hook)
}

// RegisterUnloadHook appends a new unload hook.
func (h *Service) RegisterUnloadHook(hook Hook) {
	h.log.Debug("Registered unload hook", "hook", hook)
	h.unloadHooks = append(h.unloadHooks, hook)
}

// runHooks runs the hooks in their order and joins all the returned errors.
// All hooks are executed, even if one of them fails.
func (h *Service) runHooks(ctx context.Context, plugin *plugins.Plugin, hooks []Hook) error {
	var finalErr error
	for _, hook := range hooks {
		if err := hook(ctx, plugin); err != nil {
			finalErr = errors.Join(finalErr, err)
		}
	}
	return finalErr
}

// RunBeforeLoadHooks runs all the registered before load hooks, in their order.
// It returns nil if all hooks succeed, otherwise it returns a joined error with all the hooks' errors.
// All hooks will always be executed, even if one returns an error.
func (h *Service) RunBeforeLoadHooks(ctx context.Context, plugin *plugins.Plugin) error {
	h.log.Debug("Running before init hooks")
	return h.runHooks(ctx, plugin, h.beforeLoadHooks)
}

// RunLoadHooks runs all the registered load hooks, in their order.
// It returns nil if all hooks succeed, otherwise it returns a joined error with all the hooks' errors.
// All hooks will always be executed, even if one returns an error.
func (h *Service) RunLoadHooks(ctx context.Context, plugin *plugins.Plugin) error {
	h.log.Debug("Running after init hooks")
	return h.runHooks(ctx, plugin, h.loadHooks)
}

// RunUnloadHooks runs all the registered unload hooks, in their order.
// It returns nil if all hooks succeed, otherwise it returns a joined error with all the hooks' errors.
// All hooks will always be executed, even if one returns an error.
func (h *Service) RunUnloadHooks(ctx context.Context, plugin *plugins.Plugin) error {
	h.log.Debug("Running unload hooks", "pluginID", plugin.ID)
	return h.runHooks(ctx, plugin, h.unloadHooks)
}
