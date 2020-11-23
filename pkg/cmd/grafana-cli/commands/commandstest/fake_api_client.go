package commandstest

import (
	"os"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

type FakeGrafanaComClient struct {
	GetPluginFunc      func(pluginId, repoUrl string) (models.Plugin, error)
	DownloadFileFunc   func(pluginName string, tmpFile *os.File, url string, checksum string) (err error)
	ListAllPluginsFunc func(repoUrl string) (models.PluginRepo, error)
}

func (client *FakeGrafanaComClient) GetPlugin(pluginID, repoUrl string) (models.Plugin, error) {
	if client.GetPluginFunc != nil {
		return client.GetPluginFunc(pluginID, repoUrl)
	}

	return models.Plugin{}, nil
}

func (client *FakeGrafanaComClient) DownloadFile(pluginName string, tmpFile *os.File, url string, checksum string) (err error) {
	if client.DownloadFileFunc != nil {
		return client.DownloadFileFunc(pluginName, tmpFile, url, checksum)
	}

	return nil
}

func (client *FakeGrafanaComClient) ListAllPlugins(repoURL string) (models.PluginRepo, error) {
	if client.ListAllPluginsFunc != nil {
		return client.ListAllPluginsFunc(repoURL)
	}
	return models.PluginRepo{}, nil
}
