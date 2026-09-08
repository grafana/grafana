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

type staticConfigurationProvider struct {
	configuration Configuration
}

func (p staticConfigurationProvider) Get(context.Context) (Configuration, error) {
	return p.configuration, nil
}

func TestServiceRenderStreamsWithAccessToken(t *testing.T) {
	var rendererRequest *http.Request
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		rendererRequest = r.Clone(r.Context())
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": {"image/png"}},
			Body:       io.NopCloser(bytes.NewBufferString("rendered-image")),
		}, nil
	})}

	cfg, err := ParseConfiguration(ConfigurationInput{
		RendererServerURL:   "https://renderer.example.com/render",
		RendererCallbackURL: "https://grafana.example.com/",
		RendererAuthToken:   "renderer-token",
		RenderKeyLifetime:   time.Minute,
		BuildVersion:        "13.2.0",
	})
	require.NoError(t, err)

	limits, err := ParseLimits(LimitsInput{ResponseBytes: 1024})
	require.NoError(t, err)
	service, err := NewService(staticConfigurationProvider{configuration: cfg}, NewAccessTokenAuthenticator(), limits, WithHTTPClient(client))
	require.NoError(t, err)

	request, err := ParseRequest(RequestInput{
		RenderType:  RenderPNG,
		Path:        "d/example/dashboard?panelId=1",
		Timeout:     time.Second,
		Width:       800,
		Height:      600,
		DeviceScale: 1,
		Headers: http.Header{
			"X-Access-Token": {"Bearer access-token"},
			"X-Auth-Token":   {"caller-must-not-override-renderer-auth"},
		},
	})
	require.NoError(t, err)

	result, err := service.Render(context.Background(), request)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, result.Close()) })

	var output bytes.Buffer
	_, err = result.WriteTo(&output)
	require.NoError(t, err)
	require.Equal(t, "rendered-image", output.String())
	require.Equal(t, "renderer-token", rendererRequest.Header.Get(rendererAuthTokenHeader))
	require.Equal(t, "Bearer access-token", rendererRequest.Header.Get(AccessTokenHeader))
	require.Empty(t, rendererRequest.URL.Query().Get(renderKeyQueryParameter))
	require.Equal(t, "https://grafana.example.com/d/example/dashboard?panelId=1&render=1", rendererRequest.URL.Query().Get("url"))
}

func TestServiceRenderUsesRenderKeyWithoutAccessToken(t *testing.T) {
	var rendererRequest *http.Request
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		rendererRequest = r.Clone(r.Context())
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewBufferString("rendered-image")),
		}, nil
	})}
	cfg, err := ParseConfiguration(ConfigurationInput{
		RendererServerURL:   "https://renderer.example.com/render",
		RendererCallbackURL: "https://grafana.example.com/",
		RendererAuthToken:   "renderer-token",
		RenderKeyLifetime:   time.Minute,
	})
	require.NoError(t, err)
	limits, err := ParseLimits(LimitsInput{ResponseBytes: 1024})
	require.NoError(t, err)
	service, err := NewService(staticConfigurationProvider{configuration: cfg}, NewJWTRenderKeyAuthenticator(), limits, WithHTTPClient(client))
	require.NoError(t, err)
	request, err := ParseRequest(RequestInput{
		RenderType:  RenderPNG,
		Path:        "d/example/dashboard?panelId=1",
		Timeout:     time.Second,
		Width:       800,
		Height:      600,
		DeviceScale: 1,
	})
	require.NoError(t, err)

	result, err := service.Render(context.Background(), request)
	require.NoError(t, err)
	_, err = result.WriteTo(io.Discard)
	require.NoError(t, err)
	require.NoError(t, result.Close())

	require.Equal(t, "renderer-token", rendererRequest.Header.Get(rendererAuthTokenHeader))
	require.Empty(t, rendererRequest.Header.Get(AccessTokenHeader))
	require.NotEmpty(t, rendererRequest.URL.Query().Get(renderKeyQueryParameter))
}

func TestServiceRenderUsesTenantConfigurationFromContext(t *testing.T) {
	type tenantKey struct{}

	requests := make(chan *http.Request, 2)
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		requests <- r.Clone(r.Context())
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{},
			Body:       io.NopCloser(bytes.NewBufferString("ok")),
		}, nil
	})}

	configuration := func(rendererURL, authToken, callbackURL, tenantID string) Configuration {
		cfg, err := ParseConfiguration(ConfigurationInput{
			RendererServerURL:   rendererURL + "/render",
			RendererCallbackURL: callbackURL,
			RendererAuthToken:   authToken,
			RendererTenantID:    tenantID,
			RenderKeyLifetime:   time.Minute,
		})
		require.NoError(t, err)
		return cfg
	}
	configurations := map[string]Configuration{
		"tenant-a": configuration("https://renderer-a.example.com", "token-a", "https://a.example.com/", "stack-a"),
		"tenant-b": configuration("https://renderer-b.example.com", "token-b", "https://b.example.com/", "stack-b"),
	}
	provider := configurationProviderFunc(func(ctx context.Context) (Configuration, error) {
		return configurations[ctx.Value(tenantKey{}).(string)], nil
	})
	limits, err := ParseLimits(LimitsInput{ResponseBytes: 1024})
	require.NoError(t, err)
	service, err := NewService(provider, NewAccessTokenAuthenticator(), limits, WithHTTPClient(client))
	require.NoError(t, err)
	request, err := ParseRequest(RequestInput{
		RenderType:  RenderPNG,
		Path:        "d/example/dashboard?from=now-1h",
		Timeout:     time.Second,
		Width:       800,
		Height:      600,
		DeviceScale: 1,
		Headers:     http.Header{"X-Access-Token": {"Bearer access-token"}},
	})
	require.NoError(t, err)

	for _, tenant := range []string{"tenant-a", "tenant-b"} {
		ctx := context.WithValue(context.Background(), tenantKey{}, tenant)
		result, err := service.Render(ctx, request)
		require.NoError(t, err)
		_, err = result.WriteTo(io.Discard)
		require.NoError(t, err)
		require.NoError(t, result.Close())
	}

	requestA := <-requests
	requestB := <-requests
	observed := map[string]string{
		requestA.Header.Get(rendererAuthTokenHeader): requestA.URL.Query().Get("url"),
		requestB.Header.Get(rendererAuthTokenHeader): requestB.URL.Query().Get("url"),
	}
	require.Contains(t, observed["token-a"], "a.example.com")
	require.Contains(t, observed["token-b"], "b.example.com")
	require.Equal(t, "stack-a", requestA.Header.Get(rateLimiterHeader))
	require.Equal(t, "stack-b", requestB.Header.Get(rateLimiterHeader))
}

func TestResultBoundsResponseSize(t *testing.T) {
	result := newResult(io.NopCloser(bytes.NewBufferString("12345")), RenderPNG, fileName{}, responseBytesLimit{bytes: 4}, nil)
	t.Cleanup(func() { require.NoError(t, result.Close()) })

	var output bytes.Buffer
	_, err := result.WriteTo(&output)
	require.ErrorIs(t, err, ErrResponseTooLarge)
	require.Equal(t, "1234", output.String())
}

func TestServiceHoldsConcurrencySlotUntilResultCloses(t *testing.T) {
	client := &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{}, Body: io.NopCloser(bytes.NewBufferString("ok"))}, nil
	})}
	cfg, err := ParseConfiguration(ConfigurationInput{
		RendererServerURL:   "https://renderer.example.com/render",
		RendererCallbackURL: "https://grafana.example.com/",
		RendererAuthToken:   "renderer-token",
		RenderKeyLifetime:   time.Minute,
	})
	require.NoError(t, err)
	limits, err := ParseLimits(LimitsInput{ResponseBytes: 1024})
	require.NoError(t, err)
	service, err := NewService(staticConfigurationProvider{configuration: cfg}, NewJWTRenderKeyAuthenticator(), limits, WithHTTPClient(client))
	require.NoError(t, err)
	request, err := ParseRequest(RequestInput{
		RenderType: RenderPNG, Path: "d/example/dashboard", Timeout: time.Second,
		ConcurrentLimit: 1, Width: 800, Height: 600, DeviceScale: 1,
	})
	require.NoError(t, err)

	first, err := service.Render(context.Background(), request)
	require.NoError(t, err)
	_, err = service.Render(context.Background(), request)
	require.ErrorIs(t, err, ErrConcurrentLimitReached)
	require.NoError(t, first.Close())

	third, err := service.Render(context.Background(), request)
	require.NoError(t, err)
	require.NoError(t, third.Close())
}

type configurationProviderFunc func(context.Context) (Configuration, error)

func (f configurationProviderFunc) Get(ctx context.Context) (Configuration, error) {
	return f(ctx)
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}
