package pluginproxy

import (
	"context"
	"crypto/tls"
	"errors"
	"net/http"
	"testing"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
)

func TestNewDataSourceLoader(t *testing.T) {
	ds := &datasources.DataSource{
		ID:    7,
		UID:   "abc-123",
		OrgID: 1,
		Name:  "My Prometheus",
		Type:  datasources.DS_PROMETHEUS,
		URL:   "https://prom.example.com",
	}

	loader, err := NewDataSourceLoader(ds, &dsfakes.FakeDataSourceService{})
	require.NoError(t, err)

	require.Equal(t, datasources.DS_PROMETHEUS, loader.PluginType())

	v0, err := loader.DataSource(context.Background())
	require.NoError(t, err)
	require.Equal(t, "abc-123", v0.Name, "ObjectMeta.Name should be the datasource UID")
	require.Equal(t, "My Prometheus", v0.Spec.Title(), "Spec.Title should be the human-readable name")
	require.Equal(t, "https://prom.example.com", v0.Spec.URL())
}

func TestDataSourceLoader_PassesDataSourceToService(t *testing.T) {
	ds := &datasources.DataSource{
		UID:      "abc-123",
		Type:     datasources.DS_PROMETHEUS,
		URL:      "https://prom.example.com",
		JsonData: simplejson.New(),
	}

	stub := &recordingDSService{
		password:          "pw",
		basicAuthPassword: "bap",
		values:            map[string]string{"key": "value"},
		transport:         http.DefaultTransport,
	}
	loader, err := NewDataSourceLoader(ds, stub)
	require.NoError(t, err)
	ctx := context.Background()

	pw, err := loader.DecryptedPassword(ctx)
	require.NoError(t, err)
	require.Equal(t, "pw", pw)

	bap, err := loader.DecryptedBasicAuthPassword(ctx)
	require.NoError(t, err)
	require.Equal(t, "bap", bap)

	vals, err := loader.DecryptedValues(ctx)
	require.NoError(t, err)
	require.Equal(t, map[string]string{"key": "value"}, vals)

	rt, err := loader.GetHTTPTransport(ctx, &noopProvider{})
	require.NoError(t, err)
	require.Equal(t, http.DefaultTransport, rt)

	require.Same(t, ds, stub.lastPassword, "DecryptedPassword should receive the original *datasources.DataSource")
	require.Same(t, ds, stub.lastBasicAuth, "DecryptedBasicAuthPassword should receive the original *datasources.DataSource")
	require.Same(t, ds, stub.lastValues, "DecryptedValues should receive the original *datasources.DataSource")
	require.Same(t, ds, stub.lastTransport, "GetHTTPTransport should receive the original *datasources.DataSource")
}

func TestDataSourceLoader_PropagatesServiceError(t *testing.T) {
	ds := &datasources.DataSource{UID: "abc-123", Type: datasources.DS_PROMETHEUS}
	wantErr := errors.New("boom")
	stub := &recordingDSService{err: wantErr}

	loader, err := NewDataSourceLoader(ds, stub)
	require.NoError(t, err)

	_, err = loader.DecryptedPassword(context.Background())
	require.ErrorIs(t, err, wantErr)
}

type recordingDSService struct {
	dsfakes.FakeDataSourceService

	password          string
	basicAuthPassword string
	values            map[string]string
	transport         http.RoundTripper
	err               error

	lastPassword  *datasources.DataSource
	lastBasicAuth *datasources.DataSource
	lastValues    *datasources.DataSource
	lastTransport *datasources.DataSource
}

func (s *recordingDSService) DecryptedPassword(_ context.Context, ds *datasources.DataSource) (string, error) {
	s.lastPassword = ds
	return s.password, s.err
}

func (s *recordingDSService) DecryptedBasicAuthPassword(_ context.Context, ds *datasources.DataSource) (string, error) {
	s.lastBasicAuth = ds
	return s.basicAuthPassword, s.err
}

func (s *recordingDSService) DecryptedValues(_ context.Context, ds *datasources.DataSource) (map[string]string, error) {
	s.lastValues = ds
	return s.values, s.err
}

func (s *recordingDSService) GetHTTPTransport(_ context.Context, ds *datasources.DataSource, _ httpclient.Provider, _ ...sdkhttpclient.Middleware) (http.RoundTripper, error) {
	s.lastTransport = ds
	return s.transport, s.err
}

type noopProvider struct{}

func (noopProvider) New(_ ...sdkhttpclient.Options) (*http.Client, error) {
	return http.DefaultClient, nil
}

func (noopProvider) GetTransport(_ ...sdkhttpclient.Options) (http.RoundTripper, error) {
	return http.DefaultTransport, nil
}

func (noopProvider) GetTLSConfig(_ ...sdkhttpclient.Options) (*tls.Config, error) {
	return &tls.Config{}, nil
}

var _ httpclient.Provider = noopProvider{}
