package appsettings

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/resource"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func TestGetSettingsDecryptsFromSharedGroup(t *testing.T) {
	settings := &apppluginV0.Settings{
		TypeMeta:   metav1.TypeMeta{APIVersion: "example-app/v0alpha1", Kind: "Settings"},
		ObjectMeta: metav1.ObjectMeta{Name: apppluginV0.INSTANCE_NAME, Namespace: "default"},
		Spec:       apppluginV0.SettingsSpec{Enabled: true},
		Secure:     resource.InlineSecureValues{"token": {Name: "secret-token"}},
	}
	b := &Builder{
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

func TestGetSettingsUsesCurrentLegacySecretsWithinTheSameSecond(t *testing.T) {
	// Both reads have the same updated time, and so the same resource version.
	legacy := decryptingSettings{
		ps: &pluginsettings.DTO{
			PluginID:       "example-app",
			OrgID:          1,
			Enabled:        true,
			Updated:        time.Unix(100, 0),
			SecureJSONData: map[string][]byte{"token": []byte("cipher")},
		},
		decrypted: map[string]string{"token": "old"},
	}
	store := NewReadOnlyLegacySettingsStore("example-app", legacy)
	b := &Builder{
		group: "example-app",
		getter: func(ctx context.Context, _ schema.GroupVersionResource, name string) (runtime.Object, error) {
			return store.Get(ctx, name, nil)
		},
	}
	ctx := request.WithNamespace(t.Context(), "default")

	_, loader, err := b.getSettings(ctx)
	require.NoError(t, err)
	values, err := loader(ctx)
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "old"}, values)

	legacy.decrypted["token"] = "new"

	_, loader, err = b.getSettings(ctx)
	require.NoError(t, err)
	values, err = loader(ctx)
	require.NoError(t, err)
	require.Equal(t, map[string]string{"token": "new"}, values)
}

type settingsDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (f settingsDecrypter) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, group, namespace, names...)
}
