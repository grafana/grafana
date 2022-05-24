package kvstore

import "github.com/grafana/grafana/pkg/plugins"

func shouldUseRemoteSecretsPlugin(sm *plugins.SecretsManagerManager) bool {
	return false
}
