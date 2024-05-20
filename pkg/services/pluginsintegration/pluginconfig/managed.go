package pluginconfig

type ManagedPluginService interface {
	IsManagedPlugin(pluginID string) bool
}

var _ ManagedPluginService = (*ManagedPluginChecker)(nil)

type ManagedPluginChecker struct{}

func NewManagedPluginChecker() *ManagedPluginChecker {
	return &ManagedPluginChecker{}
}

func (s *ManagedPluginChecker) IsManagedPlugin(_ string) bool {
	return false
}
