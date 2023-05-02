package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/hooks"
)

func registerPluginHooks(registry Service, hooksRegistry hooks.Registry) {
	hooksRegistry.RegisterAfterInitHook(hooks.HookFunc(registry.Add))
	hooksRegistry.RegisterUnloadHook(hooks.HookFunc(func(ctx context.Context, plugin *plugins.Plugin) error {
		return registry.Remove(ctx, plugin.ID)
	}))
}
