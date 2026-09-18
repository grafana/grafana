package provisioning

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"gopkg.in/ini.v1"
	"k8s.io/client-go/rest"

	apisprovisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

func TestConnectionFactoryUsesConfiguredTypes(t *testing.T) {
	configuredType := apisprovisioning.ConnectionType("configured")
	extras := make([]connection.Extra, 0, 2)
	for _, connectionType := range []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		configuredType,
	} {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	cfg := ControllerConfig{
		Settings:         &setting.Cfg{ProvisioningConnectionTypes: []string{string(configuredType)}},
		connectionExtras: extras,
		tracer:           tracing.NewNoopTracerService(),
	}
	factory, err := cfg.ConnectionFactory()
	require.NoError(t, err)
	require.ElementsMatch(t, []apisprovisioning.ConnectionType{configuredType}, factory.Types())
}

func TestDefaultConnectionTypes(t *testing.T) {
	registeredTypes := []apisprovisioning.ConnectionType{
		apisprovisioning.GithubConnectionType,
		apisprovisioning.GithubEnterpriseConnectionType,
		apisprovisioning.GithubOAuthConnectionType,
		apisprovisioning.GithubEnterpriseOAuthConnectionType,
		apisprovisioning.BitbucketOAuthConnectionType,
		apisprovisioning.GitlabOAuthConnectionType,
	}
	extras := make([]connection.Extra, 0, len(registeredTypes))
	for _, connectionType := range registeredTypes {
		extra := connection.NewMockExtra(t)
		extra.On("Type").Return(connectionType)
		extras = append(extras, extra)
	}

	require.ElementsMatch(t, []string{"github", "githubEnterprise"}, defaultConnectionTypes(extras))
}

// roundTripperFunc lets a plain function stand in as an http.RoundTripper.
type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// TestWrapWithTracing verifies that the typed provisioning client's transport is wrapped
// with otelhttp so Job updates and Repository/Connection status patches propagate trace
// context, and that it composes with (rather than replaces) an existing WrapTransport such
// as the token-exchange wrapper.
func TestWrapWithTracing(t *testing.T) {
	t.Run("wraps a config without an existing transport wrapper", func(t *testing.T) {
		cfg := &rest.Config{}
		wrapWithTracing(cfg)
		require.NotNil(t, cfg.WrapTransport)

		base := roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil })
		_, ok := cfg.WrapTransport(base).(*otelhttp.Transport)
		require.True(t, ok, "expected the outermost transport to be an otelhttp.Transport")
	})

	t.Run("composes with an existing transport wrapper", func(t *testing.T) {
		inner := roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil })
		innerCalled := false
		cfg := &rest.Config{
			WrapTransport: func(http.RoundTripper) http.RoundTripper {
				innerCalled = true
				return inner
			},
		}

		wrapWithTracing(cfg)

		got := cfg.WrapTransport(roundTripperFunc(func(*http.Request) (*http.Response, error) { return nil, nil }))
		_, ok := got.(*otelhttp.Transport)
		require.True(t, ok, "otelhttp must remain the outermost transport")
		require.True(t, innerCalled, "the pre-existing transport wrapper must still be invoked")
	})
}

// The keys-only re-list posts to a route the typed clientset has no method for, so
// it uses ProvisioningRESTClient. That client has to carry the same exchanged
// access token as every other call the operator makes, or it authenticates as
// nobody on a real cluster. Asserted end to end through a stub signer.
func TestProvisioningRESTClientCarriesTheExchangedToken(t *testing.T) {
	signer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// authlib wraps the token in a data envelope.
		_, _ = w.Write([]byte(`{"data":{"token":"exchanged-access-token"}}`))
	}))
	t.Cleanup(signer.Close)

	var gotAuth, gotPath string
	apiserver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("X-Access-Token")
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"kind":"PartialObjectMetadataList","metadata":{"resourceVersion":"1"},"items":[]}`))
	}))
	t.Cleanup(apiserver.Close)

	raw := ini.Empty()
	grpcSec, err := raw.NewSection("grpc_client_authentication")
	require.NoError(t, err)
	_, err = grpcSec.NewKey("token", "operator-token")
	require.NoError(t, err)
	_, err = grpcSec.NewKey("token_exchange_url", signer.URL)
	require.NoError(t, err)
	operatorSec, err := raw.NewSection("operator")
	require.NoError(t, err)
	_, err = operatorSec.NewKey("provisioning_server_url", apiserver.URL)
	require.NoError(t, err)

	cfg := &ControllerConfig{Settings: &setting.Cfg{Raw: raw}, tracer: tracing.NewNoopTracerService()}

	client, err := cfg.ProvisioningRESTClient()
	require.NoError(t, err)

	_, err = client.Post().AbsPath("/apis", apisprovisioning.GROUP, apisprovisioning.VERSION, "connections", "list-keys").
		Body([]byte(`{}`)).DoRaw(t.Context())
	require.NoError(t, err)

	assert.Equal(t, "Bearer exchanged-access-token", gotAuth,
		"the REST client must send the exchanged token, as the clientset's transport does")
	assert.Equal(t, "/apis/provisioning.grafana.app/v0alpha1/connections/list-keys", gotPath)
}
