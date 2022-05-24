package kvstore

import (
	"github.com/grafana/grafana/pkg/plugins"
)

type UseRemoteSecretsPluginCheck interface {
	ShouldUseRemoteSecretsPlugin() bool
	GetManager() plugins.SecretsManagerManager
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

func (c *OSSRemoteSecretsPluginCheck) GetManager() plugins.SecretsManagerManager {
	return nil
}
