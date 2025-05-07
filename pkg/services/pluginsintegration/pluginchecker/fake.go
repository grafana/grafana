package pluginchecker

import (
	"context"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type FakePluginUpdateChecker struct {
	IsUpdatableFunc func(ctx context.Context, plugin pluginstore.Plugin) bool
	CanUpdateFunc   func(pluginId string, currentVersion string, targetVersion string, onlyMinor bool) bool
}

func (f *FakePluginUpdateChecker) IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool {
	if f.IsUpdatableFunc != nil {
		return f.IsUpdatableFunc(ctx, plugin)
	}
	return true
}

func (f *FakePluginUpdateChecker) CanUpdate(pluginId string, currentVersion string, targetVersion string, onlyMinor bool) bool {
	if f.CanUpdateFunc != nil {
		return f.CanUpdateFunc(pluginId, currentVersion, targetVersion, onlyMinor)
	}
	return true
}

type FakePluginPreinstall struct {
	IsPinnedFunc       func(pluginID string) bool
	IsPreinstalledFunc func(pluginID string) bool
}

func (f *FakePluginPreinstall) IsPinned(pluginID string) bool {
	if f.IsPinnedFunc != nil {
		return f.IsPinnedFunc(pluginID)
	}
	return false
}

func (f *FakePluginPreinstall) IsPreinstalled(pluginID string) bool {
	if f.IsPreinstalledFunc != nil {
		return f.IsPreinstalledFunc(pluginID)
	}
	return false
}
