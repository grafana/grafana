package rendering

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type testKeys struct{ released atomic.Int32 }

func (*testKeys) Get(context.Context, AuthOpts) (RenderCredentials, error) {
	return RenderCredentials{Headers: http.Header{"X-Access-Token": {"Bearer exchanged"}}}, nil
}
func (p *testKeys) Release(context.Context, RenderCredentials)         { p.released.Add(1) }
func (*testKeys) Validate(context.Context, string) (*RenderUser, bool) { return nil, false }

func rendererResponse(body string) *http.Response {
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Disposition": {`attachment; filename="data.csv"`}}, Body: io.NopCloser(strings.NewReader(body))}
}

func TestRenderMemory(t *testing.T) {
	for _, format := range []RenderType{RenderPNG, RenderPDF, RenderCSV} {
		t.Run(string(format), func(t *testing.T) {
			keys := &testKeys{}
			var settingsCalls int
			s, err := NewService(Config{
				Renderer: ImageRendererConfig{URL: "https://renderer/render", AuthToken: "renderer-secret"},
				Settings: func(context.Context) (Settings, error) {
					settingsCalls++
					return Settings{CallbackURL: "https://stack.grafana/", TenantID: "stacks-1"}, nil
				},
				Keys: keys, Store: MemoryStore{MaxBytes: 1024},
				Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
					require.Equal(t, "renderer-secret", r.Header.Get(authTokenHeader))
					require.Equal(t, "Bearer exchanged", r.Header.Get("X-Access-Token"))
					require.Equal(t, "en-US", r.Header.Get("Accept-Language"))
					require.Equal(t, "https://stack.grafana/d/test?orgId=1&render=1", r.URL.Query().Get("url"))
					require.Equal(t, "stack.grafana", r.URL.Query().Get("domain"))
					require.Empty(t, r.URL.Query().Get("renderKey"))
					require.Equal(t, string(format), r.URL.Query().Get("encoding"))
					return rendererResponse("rendered content"), nil
				})},
			})
			require.NoError(t, err)
			opts := CommonOpts{Path: "d/test?orgId=1", TimeoutOpts: TimeoutOpts{Timeout: time.Second}, Headers: map[string][]string{
				"Accept-Language": {"en-US"}, "x-auth-token": {"untrusted"}, "x-access-token": {"untrusted"},
			}}
			var result *Result
			if format == RenderCSV {
				csv, csvErr := s.RenderCSV(t.Context(), CSVOpts{CommonOpts: opts})
				result, err = (*Result)(csv), csvErr
				require.NoError(t, err)
				require.Equal(t, "data.csv", result.FileName)
			} else {
				rendered, renderErr := s.Render(t.Context(), format, Opts{CommonOpts: opts})
				result, err = (*Result)(rendered), renderErr
			}
			require.NoError(t, err)
			require.Empty(t, result.FilePath)
			require.Equal(t, []byte("rendered content"), result.Data)
			require.Equal(t, 1, settingsCalls)
			require.EqualValues(t, 1, keys.released.Load())
			require.Equal(t, "untrusted", opts.Headers["x-access-token"][0])
		})
	}
}

func TestRenderTenantConcurrency(t *testing.T) {
	type tenantKey struct{}
	entered, release := make(chan struct{}), make(chan struct{})
	keys := &testKeys{}
	s, err := NewService(Config{
		Renderer: ImageRendererConfig{URL: "https://renderer/render", AuthToken: "renderer-secret"},
		Settings: func(ctx context.Context) (Settings, error) {
			return Settings{CallbackURL: "https://grafana/", TenantID: ctx.Value(tenantKey{}).(string), ConcurrentLimit: 1}, nil
		},
		Keys: keys, Store: MemoryStore{MaxBytes: 1024},
		Client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if strings.Contains(r.URL.Query().Get("url"), "block") {
				close(entered)
				select {
				case <-release:
				case <-r.Context().Done():
					return nil, r.Context().Err()
				}
			}
			return rendererResponse("ok"), nil
		})},
	})
	require.NoError(t, err)
	ctx := context.WithValue(t.Context(), tenantKey{}, "stacks-a")
	opts := CommonOpts{AuthOpts: AuthOpts{OrgID: 1}, TimeoutOpts: TimeoutOpts{Timeout: time.Minute}, Path: "block?orgId=1"}
	done := make(chan error, 1)
	go func() { _, err := s.Render(ctx, RenderPNG, Opts{CommonOpts: opts}); done <- err }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("first render never started")
	}
	opts.Path = "d/test?orgId=1"
	opts.ConcurrentLimit = 100
	_, err = s.RenderCSV(ctx, CSVOpts{CommonOpts: opts})
	require.ErrorIs(t, err, ErrConcurrentLimitReached)
	_, err = s.RenderCSV(context.WithValue(ctx, tenantKey{}, "stacks-b"), CSVOpts{CommonOpts: opts})
	require.NoError(t, err, "another stack must not consume this stack's quota")
	opts.OrgID = 2
	_, err = s.RenderCSV(ctx, CSVOpts{CommonOpts: opts})
	require.NoError(t, err, "another org must have its own quota")
	close(release)
	require.NoError(t, <-done)
	opts.OrgID = 1
	_, err = s.RenderCSV(ctx, CSVOpts{CommonOpts: opts})
	require.NoError(t, err, "completed requests must release their quota")
	require.Empty(t, s.limiter.(*LocalConcurrencyLimiter).inProgress)
}

func TestRenderSettingsFailure(t *testing.T) {
	want := errors.New("settings unavailable")
	keys := &testKeys{}
	s, err := NewService(Config{
		Renderer: ImageRendererConfig{URL: "https://renderer/render", AuthToken: "renderer-secret"}, Settings: func(context.Context) (Settings, error) { return Settings{}, want }, Keys: keys, Store: MemoryStore{MaxBytes: 1024}})
	require.NoError(t, err)
	_, err = s.Render(t.Context(), RenderPNG, Opts{})
	require.ErrorIs(t, err, want)
	_, err = s.RenderCSV(t.Context(), CSVOpts{})
	require.ErrorIs(t, err, want)
	require.True(t, s.IsAvailable(t.Context()), "service availability does not depend on tenant settings")
	require.Zero(t, keys.released.Load())
}

func TestSingleTenantRendering(t *testing.T) {
	for _, jwt := range []bool{false, true} {
		t.Run(map[bool]string{false: "cached keys", true: "JWT keys"}[jwt], func(t *testing.T) {
			for _, format := range []RenderType{RenderPNG, RenderPDF, RenderCSV} {
				t.Run(string(format), func(t *testing.T) {
					cfg := setting.NewCfg()
					cfg.RendererServerUrl, cfg.AppURL, cfg.RendererAuthToken = "https://renderer/render", "https://grafana/subpath/", "secret"
					cfg.BuildVersion = "12.4.0"
					cfg.RendererRenderKeyLifeTime = time.Minute
					cfg.ImagesDir, cfg.CSVsDir, cfg.PDFsDir = t.TempDir(), t.TempDir(), t.TempDir()
					features := featuremgmt.WithFeatures()
					if jwt {
						features = featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT)
					}
					s, err := ProvideService(cfg, features, nil)
					require.NoError(t, err)
					if !jwt {
						s.keys.(*perRequestRenderKeyProvider).cache = remotecache.NewFakeCacheStorage()
					}
					var renderKey string
					s.netClient.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
						require.Equal(t, "Grafana/12.4.0", r.Header.Get("User-Agent"))
						require.Equal(t, "https://grafana/subpath/d/test?orgId=1&render=1", r.URL.Query().Get("url"))
						renderKey = r.URL.Query().Get("renderKey")
						user, ok := s.GetRenderUser(t.Context(), renderKey)
						require.True(t, ok)
						require.EqualValues(t, 7, user.UserID)
						require.Equal(t, "secret", r.Header.Get(authTokenHeader))
						return rendererResponse("rendered content"), nil
					})
					opts := CommonOpts{Path: "d/test?orgId=1", AuthOpts: AuthOpts{OrgID: 1, UserID: 7}, TimeoutOpts: TimeoutOpts{Timeout: time.Second}}
					var result *Result
					var dir string
					if format == RenderCSV {
						csv, csvErr := s.RenderCSV(t.Context(), CSVOpts{CommonOpts: opts})
						result, err = (*Result)(csv), csvErr
						dir = cfg.CSVsDir
					} else {
						rendered, renderErr := s.Render(t.Context(), format, Opts{CommonOpts: opts})
						result, err = (*Result)(rendered), renderErr
						dir = cfg.ImagesDir
						if format == RenderPDF {
							dir = cfg.PDFsDir
						}
					}
					require.NoError(t, err)
					require.Empty(t, result.Data)
					require.Equal(t, dir, filepath.Dir(result.FilePath))
					require.Equal(t, "."+string(format), filepath.Ext(result.FilePath))
					data, err := os.ReadFile(result.FilePath)
					require.NoError(t, err)
					require.Equal(t, "rendered content", string(data))
					if !jwt {
						_, ok := s.GetRenderUser(t.Context(), renderKey)
						require.False(t, ok, "cached key must be removed after rendering")
					}
				})
			}
		})
	}
}
