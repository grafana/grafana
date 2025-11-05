package mocksvcs

import (
	"context"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type UpdateChecker struct {
}

func (m *UpdateChecker) IsUpdatable(ctx context.Context, plugin pluginstore.Plugin) bool {
	return true
}

func (m *UpdateChecker) CanUpdate(pluginId string, currentVersion string, targetVersion string, onlyMinor bool) bool {
	return true
}
