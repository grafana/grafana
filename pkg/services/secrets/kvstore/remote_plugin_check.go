package kvstore

import (
	"github.com/grafana/grafana/pkg/plugins/manager"
)

type UseRemoteSecretsPluginCheck interface {
	ShouldUseRemoteSecretsPlugin() bool
	GetManager() *manager.PluginManager
}

type OSSRemoteSecretsPluginCheck struct {
	UseRemoteSecretsPluginCheck
}

func ProvideRemotePluginCheck() *OSSRemoteSecretsPluginCheck {
	return &OSSRemoteSecretsPluginCheck{}
}

func (c *OSSRemoteSecretsPluginCheck) ShouldUseRemoteSecretsPlugin() bool {
	return false
}

func (c *OSSRemoteSecretsPluginCheck) GetManager() *manager.PluginManager {
	return nil
}
