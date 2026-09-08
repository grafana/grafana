package v2

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCapabilityLookupUsesAndCachesTenantConfiguration(t *testing.T) {
	type tenantKey struct{}
	configurations := map[string]Configuration{}
	for _, tenant := range []string{"a", "b"} {
		cfg, err := ParseConfiguration(ConfigurationInput{
			RendererServerURL:   "https://renderer-" + tenant + ".example.com/render",
			RendererCallbackURL: "https://grafana-" + tenant + ".example.com/",
			RendererAuthToken:   "auth-" + tenant,
			RendererTenantID:    "tenant-" + tenant,
			RenderKeyLifetime:   time.Minute,
		})
		require.NoError(t, err)
		configurations[tenant] = cfg
	}
	provider := configurationProviderFunc(func(ctx context.Context) (Configuration, error) {
		return configurations[ctx.Value(tenantKey{}).(string)], nil
	})

	requests := map[string]int{}
	client := &http.Client{Transport: roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		tenant := request.Header.Get(rateLimiterHeader)
		requests[tenant]++
		require.Equal(t, "auth-"+tenant[len("tenant-"):], request.Header.Get(rendererAuthTokenHeader))
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"application/json"}},
			Body:       io.NopCloser(bytes.NewBufferString(`{"version":"3.12.0"}`)),
		}, nil
	})}
	limits, err := ParseLimits(LimitsInput{ResponseBytes: 1024})
	require.NoError(t, err)
	service, err := NewService(provider, NewAccessTokenAuthenticator(), limits, WithHTTPClient(client))
	require.NoError(t, err)

	for _, tenant := range []string{"a", "a", "b"} {
		ctx := context.WithValue(context.Background(), tenantKey{}, tenant)
		support, err := service.HasCapability(ctx, CapabilityPDFRendering)
		require.NoError(t, err)
		require.True(t, support.Supported)
	}
	require.Equal(t, map[string]int{"tenant-a": 1, "tenant-b": 1}, requests)
}
