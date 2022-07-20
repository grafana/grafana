package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/secretsmanagerplugin"
)

type UseRemoteSecretsPluginCheck interface {
	ShouldUseRemoteSecretsPlugin() bool
	StartAndReturnPlugin(ctx context.Context) (secretsmanagerplugin.SecretsManagerPlugin, error)
}

type OSSRemoteSecretsPluginCheck struct{}

func ProvideRemotePluginCheck() *OSSRemoteSecretsPluginCheck {
	return &OSSRemoteSecretsPluginCheck{}
}

func (c OSSRemoteSecretsPluginCheck) ShouldUseRemoteSecretsPlugin() bool {
	return false
}

func (c OSSRemoteSecretsPluginCheck) StartAndReturnPlugin(ctx context.Context) (secretsmanagerplugin.SecretsManagerPlugin, error) {
	log.New("ossremotesecretsplugincheck").Error("OSSRemoteSecretsPluginCheck.StartAndReturnPlugin() should not have been called")
	return nil, nil
}

var _ UseRemoteSecretsPluginCheck = OSSRemoteSecretsPluginCheck{}
