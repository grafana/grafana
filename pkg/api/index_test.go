package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHTTPServer_Index(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// viewsPath, err := filepath.Abs("../../public/views")
	// require.NoError(t, err)
	// _, err = os.Stat(viewsPath)
	// require.NoError(t, err)

	// viewFsys, err := fs.Sub(grafana.PublicViewsFS, "public/views")
	// require.NoError(t, err)

	// srv := setupSimpleHTTPServer(nil)

	// ch := contexthandler.ProvideService(srv.Cfg, srv.tracer, srv.authnService)

	srv := SetupAPITestServer(t)

	// m := web.New()
	// m.Use(ch.Middleware)

	// m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))
	// m.UseMiddleware(web.RendererWithFS(viewFsys, "[[", "]]"))
	// m.Get("/", srv.Index)

	// req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	// resp := httptest.NewRecorder()

	// m.ServeHTTP(resp, req)

	// srv.ServeHTTP(resp, req)

	client := &http.Client{
		Transport: &dumpTransport{t, http.DefaultTransport},
	}
	http.DefaultClient = client

	req := srv.NewGetRequest("/invite/1234").WithContext(ctx)
	resp, err := srv.Send(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(b), "Grafana")

	require.Equal(t, http.StatusOK, resp.StatusCode)
}

type dumpTransport struct {
	t *testing.T

	http.RoundTripper
}

func (d *dumpTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	b, err := httputil.DumpRequest(req, true)
	if err != nil {
		return nil, fmt.Errorf("dump request: %w", err)
	}

	d.t.Logf("request: %s", string(b))

	resp, err := d.RoundTripper.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("round trip: %w", err)
	}

	b, err = httputil.DumpResponse(resp, true)
	if err != nil {
		return nil, fmt.Errorf("dump response: %w", err)
	}

	d.t.Logf("response: %s", string(b))

	return resp, nil
}
