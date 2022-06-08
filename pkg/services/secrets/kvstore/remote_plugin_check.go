package kvstore

import (
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
)

type UseRemoteSecretsPluginCheck interface {
	ShouldUseRemoteSecretsPlugin() bool
	GetPlugin() (secretsmanagerplugin.SecretsManagerPlugin, error)
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

func (c *OSSRemoteSecretsPluginCheck) GetPlugin() (secretsmanagerplugin.SecretsManagerPlugin, error) {
	return nil, nil
}
