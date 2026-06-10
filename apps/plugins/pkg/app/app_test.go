package app

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestNewPluginsAppInstaller_DecoratePluginStorageHookProvider(t *testing.T) {
	sentinel := &appTestPluginStorageHookProvider{}
	decorate := func(base PluginStorageHookProvider) PluginStorageHookProvider {
		return sentinel
	}

	installer, err := NewPluginsAppInstaller(PluginAppInstallerConfig{
		Logger:                            &logging.NoOpLogger{},
		MetaProviderManager:               meta.NewProviderManager(&appTestMetaProvider{}),
		DecoratePluginStorageHookProvider: decorate,
	})
	require.NoError(t, err)
	require.NotNil(t, installer.config.DecoratePluginStorageHookProvider)
	// The decorator we passed is the one stored: invoking it returns our sentinel.
	require.Same(t, sentinel, installer.config.DecoratePluginStorageHookProvider(nil))
}

type appTestMetaProvider struct{}

func (p *appTestMetaProvider) Name() string {
	return "app-test"
}

func (p *appTestMetaProvider) GetMeta(context.Context, meta.PluginRef) (*meta.Result, error) {
	return &meta.Result{TTL: time.Minute}, nil
}

type appTestPluginStorageHookProvider struct{}

func (p *appTestPluginStorageHookProvider) BeginCreate(context.Context, *pluginsv0alpha1.Plugin, *metav1.CreateOptions) (genericregistry.FinishFunc, error) {
	return nil, nil
}

func (p *appTestPluginStorageHookProvider) AfterCreate(context.Context, *pluginsv0alpha1.Plugin, *metav1.CreateOptions) error {
	return nil
}

func (p *appTestPluginStorageHookProvider) BeginUpdate(context.Context, *pluginsv0alpha1.Plugin, *pluginsv0alpha1.Plugin, *metav1.UpdateOptions) (genericregistry.FinishFunc, error) {
	return nil, nil
}

func (p *appTestPluginStorageHookProvider) AfterUpdate(context.Context, *pluginsv0alpha1.Plugin, *metav1.UpdateOptions) error {
	return nil
}

func (p *appTestPluginStorageHookProvider) AfterDelete(context.Context, *pluginsv0alpha1.Plugin, *metav1.DeleteOptions) error {
	return nil
}
