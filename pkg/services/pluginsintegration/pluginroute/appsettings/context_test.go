package appsettings

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
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

type settingsDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (f settingsDecrypter) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, group, namespace, names...)
}

func TestForwardAccessToken(t *testing.T) {
	for name, newRequest := range map[string]func() backend.ForwardHTTPHeaders{
		"health":   func() backend.ForwardHTTPHeaders { return &backend.CheckHealthRequest{} },
		"resource": func() backend.ForwardHTTPHeaders { return &backend.CallResourceRequest{} },
	} {
		t.Run(name, func(t *testing.T) {
			for _, tc := range []struct {
				name string
				user *identity.StaticRequester
				want string
			}{
				{name: "OBO without an ID token", user: &identity.StaticRequester{AccessToken: "verified-obo"}, want: "verified-obo"},
				{name: "no access token", user: &identity.StaticRequester{}},
				{name: "no requester"},
			} {
				t.Run(tc.name, func(t *testing.T) {
					ctx := t.Context()
					if tc.user != nil {
						ctx = identity.WithRequester(ctx, tc.user)
					}
					req := newRequest()
					req.SetHTTPHeader("X-Access-Token", "unverified")
					forwardAccessToken(ctx, req)
					require.Equal(t, tc.want, req.GetHTTPHeader("X-Access-Token"))
					require.Empty(t, req.GetHTTPHeader("X-Grafana-Id"))
				})
			}
		})
	}
}
