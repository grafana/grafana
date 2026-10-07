package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
)

func TestGetSettingsDecryptsFromSharedGroup(t *testing.T) {
	settings := &apppluginV0.Settings{
		APIVersion: "example-app/v0alpha1", Kind: "Settings",
		Name: apppluginV0.INSTANCE_NAME, Namespace: "default",
		Spec:   apppluginV0.SettingsSpec{Enabled: true},
		Secure: common.InlineSecureValues{"token": {Name: "secret-token"}},
	}
	b := &AppPluginAPIBuilder{
		group: "example-app",
		getter: func(_ context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error) {
			require.Equal(t, "example-app", gvr.Group)
			require.Equal(t, apppluginV0.INSTANCE_NAME, name)
			return settings, nil
		},
		decrypter: settingsDecrypter(func(_ context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
			require.Equal(t, apppluginV0.GROUP, group)
			require.Equal(t, "default", namespace)
			require.Equal(t, []string{"secret-token"}, names)
			value := secretv1beta1.ExposedSecureValue("token-value")
			return map[string]decrypt.DecryptResult{"secret-token": decrypt.NewDecryptResultValue(&value)}, nil
		}),
	}
	got, loader, err := b.getSettings(t.Context())
	require.NoError(t, err)
	values, err := loader(t.Context())
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "token-value"}, values)
	require.Same(t, settings, got)
	require.Equal(t, "example-app/v0alpha1", got.APIVersion)
	require.Equal(t, apppluginV0.INSTANCE_NAME, got.Name)
}

type settingsDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (f settingsDecrypter) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, group, namespace, names...)
}
