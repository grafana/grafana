package ssosettingsimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	settingsvc "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeSettingService struct {
	settingsvc.Service
	settings     []*settingsvc.Setting
	err          error
	gotNamespace string
	gotSelector  metav1.LabelSelector
}

func (f *fakeSettingService) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingsvc.Setting, error) {
	f.gotNamespace = request.NamespaceValue(ctx)
	f.gotSelector = selector
	return f.settings, f.err
}

func TestNamespacedSettingsClient_List(t *testing.T) {
	t.Run("stamps the configured namespace on the context", func(t *testing.T) {
		svc := &fakeSettingService{}
		client := &namespacedSettingsClient{svc: svc, namespace: "stacks-42"}

		_, err := client.List(context.Background(), metav1.LabelSelector{})

		require.NoError(t, err)
		require.Equal(t, "stacks-42", svc.gotNamespace)
	})

	t.Run("passes the selector through and returns the results verbatim", func(t *testing.T) {
		want := []*settingsvc.Setting{{Section: "auth.saml", Key: "enabled", Value: "true"}}
		svc := &fakeSettingService{settings: want}
		client := &namespacedSettingsClient{svc: svc, namespace: "stacks-42"}
		selector := metav1.LabelSelector{MatchLabels: map[string]string{"section": "auth.saml"}}

		got, err := client.List(context.Background(), selector)

		require.NoError(t, err)
		require.Equal(t, want, got)
		require.Equal(t, selector, svc.gotSelector)
	})

	t.Run("propagates errors from the underlying service", func(t *testing.T) {
		listErr := errors.New("settings service unavailable")
		svc := &fakeSettingService{err: listErr}
		client := &namespacedSettingsClient{svc: svc, namespace: "stacks-42"}

		_, err := client.List(context.Background(), metav1.LabelSelector{})

		require.ErrorIs(t, err, listErr)
	})
}

func TestNewMTSettingsClient(t *testing.T) {
	configuredCfg := func(t *testing.T) *setting.Cfg {
		t.Helper()
		cfg := setting.NewCfg()
		_, err := cfg.Raw.Section("settings_service").NewKey("url", "http://localhost:6446")
		require.NoError(t, err)
		_, err = cfg.Raw.Section("grpc_client_authentication").NewKey("token", "test-token")
		require.NoError(t, err)
		_, err = cfg.Raw.Section("grpc_client_authentication").NewKey("token_exchange_url", "http://localhost:6481/sign/access-token")
		require.NoError(t, err)
		return cfg
	}

	t.Run("returns nil without error when not configured", func(t *testing.T) {
		cfg := setting.NewCfg()

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.NoError(t, err)
		require.Nil(t, client)
	})

	t.Run("errors when the authentication token is missing", func(t *testing.T) {
		cfg := setting.NewCfg()
		_, err := cfg.Raw.Section("settings_service").NewKey("url", "http://localhost:6446")
		require.NoError(t, err)

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.ErrorContains(t, err, "grpc_client_authentication.token is required")
		require.Nil(t, client)
	})

	t.Run("errors when the token exchange URL is missing", func(t *testing.T) {
		cfg := setting.NewCfg()
		_, err := cfg.Raw.Section("settings_service").NewKey("url", "http://localhost:6446")
		require.NoError(t, err)
		_, err = cfg.Raw.Section("grpc_client_authentication").NewKey("token", "test-token")
		require.NoError(t, err)

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.ErrorContains(t, err, "grpc_client_authentication.token_exchange_url is required")
		require.Nil(t, client)
	})

	t.Run("errors on a non-numeric stack ID instead of deriving a wrong namespace", func(t *testing.T) {
		cfg := configuredCfg(t)
		cfg.StackID = "stacks-42"

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.ErrorContains(t, err, "is not numeric")
		require.Nil(t, client)
	})

	t.Run("builds a client scoped to the stack namespace", func(t *testing.T) {
		cfg := configuredCfg(t)
		cfg.StackID = "42"

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.NoError(t, err)
		require.NotNil(t, client)

		namespaced, ok := client.(*namespacedSettingsClient)
		require.True(t, ok)
		require.Equal(t, "stacks-42", namespaced.namespace)
	})

	t.Run("falls back to the org-1 namespace without a stack ID", func(t *testing.T) {
		cfg := configuredCfg(t)

		client, err := newMTSettingsClient(cfg, prometheus.NewRegistry())

		require.NoError(t, err)
		require.NotNil(t, client)

		namespaced, ok := client.(*namespacedSettingsClient)
		require.True(t, ok)
		require.Equal(t, "default", namespaced.namespace)
	})

	t.Run("tolerates re-registration of the client metrics", func(t *testing.T) {
		registry := prometheus.NewRegistry()

		_, err := newMTSettingsClient(configuredCfg(t), registry)
		require.NoError(t, err)

		client, err := newMTSettingsClient(configuredCfg(t), registry)
		require.NoError(t, err)
		require.NotNil(t, client)
	})
}
