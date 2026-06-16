package app

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func TestNewPluginsAppInstaller_WrapPluginStorageAfterHooks(t *testing.T) {
	sentinel := &appTestPluginStorageAfterHookProvider{}
	wrap := func(base PluginStorageAfterHookProvider) PluginStorageAfterHookProvider {
		return sentinel
	}

	installer, err := NewPluginsAppInstaller(PluginAppInstallerConfig{
		Logger:                      &logging.NoOpLogger{},
		MetaProviderManager:         meta.NewProviderManager(&appTestMetaProvider{}),
		WrapPluginStorageAfterHooks: wrap,
	})
	require.NoError(t, err)
	require.NotNil(t, installer.config.WrapPluginStorageAfterHooks)
	// The wrapper we passed is the one stored: invoking it returns our sentinel.
	require.Same(t, sentinel, installer.config.WrapPluginStorageAfterHooks(nil))
}

type appTestMetaProvider struct{}

func (p *appTestMetaProvider) Name() string {
	return "app-test"
}

func (p *appTestMetaProvider) GetMeta(context.Context, meta.PluginRef) (*meta.Result, error) {
	return &meta.Result{TTL: time.Minute}, nil
}

type appTestPluginStorageAfterHookProvider struct{}

func (p *appTestPluginStorageAfterHookProvider) AfterCreate(context.Context, *pluginsv0alpha1.Plugin, *metav1.CreateOptions) error {
	return nil
}

func (p *appTestPluginStorageAfterHookProvider) AfterUpdate(context.Context, *pluginsv0alpha1.Plugin, *metav1.UpdateOptions) error {
	return nil
}

func (p *appTestPluginStorageAfterHookProvider) AfterDelete(context.Context, *pluginsv0alpha1.Plugin, *metav1.DeleteOptions) error {
	return nil
}
