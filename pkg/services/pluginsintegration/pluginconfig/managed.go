package pluginconfig

import "github.com/grafana/grafana/pkg/setting"

type ManagedPluginService interface {
	IsManagedPlugin(pluginID string) bool
}

var _ ManagedPluginService = (*ManagedPluginChecker)(nil)

type ManagedPluginChecker struct {
	cfg *setting.Cfg
}

func NewManagedPluginChecker() *ManagedPluginChecker {
	return &ManagedPluginChecker{}
}

func (s *ManagedPluginChecker) IsManagedPlugin(_ string) bool {
	return false
}
