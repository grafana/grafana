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

type OSSRemoteSecretsPluginCheck struct {
	log log.Logger
}

func ProvideRemotePluginCheck() *OSSRemoteSecretsPluginCheck {
	return &OSSRemoteSecretsPluginCheck{
		log: log.New("ossremotesecretsplugincheck"),
	}
}

func (c OSSRemoteSecretsPluginCheck) ShouldUseRemoteSecretsPlugin() bool {
	return false
}

func (c OSSRemoteSecretsPluginCheck) StartAndReturnPlugin(ctx context.Context) (secretsmanagerplugin.SecretsManagerPlugin, error) {
	c.log.Warn("OSSRemoteSecretsPluginCheck.StartAndReturnPlugin() was called by mistake. Secrets Manager plugins are enterprise only.")
	return nil, nil
}

var _ UseRemoteSecretsPluginCheck = OSSRemoteSecretsPluginCheck{}
