package kvstore

import (
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
)

type UseRemoteSecretsPluginCheck interface {
	ShouldUseRemoteSecretsPlugin() (bool, error)
	GetPlugin() (secretsmanagerplugin.SecretsManagerPlugin, error)
}

type OSSRemoteSecretsPluginCheck struct {
	UseRemoteSecretsPluginCheck
}

func ProvideRemotePluginCheck() *OSSRemoteSecretsPluginCheck {
	return &OSSRemoteSecretsPluginCheck{}
}

func (c *OSSRemoteSecretsPluginCheck) ShouldUseRemoteSecretsPlugin() (bool, error) {
	return false, nil
}

func (c *OSSRemoteSecretsPluginCheck) GetPlugin() (secretsmanagerplugin.SecretsManagerPlugin, error) {
	return nil, nil
}
