package app

import (
	"context"

	serverstorage "k8s.io/apiserver/pkg/server/storage"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

type PluginRegistry interface {
	Plugin(ctx context.Context, name string) (*pluginsv0alpha1.PluginInstall, bool)
	Plugins(ctx context.Context) []pluginsv0alpha1.PluginInstall
}

// Config is the configuration for the plugins app.
type Config struct {
	InMemoryRegistry PluginRegistry
	ResourceConfig   *serverstorage.ResourceConfig
}
