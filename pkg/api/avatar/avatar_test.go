package avatar

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const (
	defaultHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	customHash  = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

var nonsenseBody = []byte("Bogus API response")

type mockGravatarOpts struct {
	avatarBody   []byte
	failFetch    bool
	customHashes map[string]bool
}

func setupMockGravatarServer(t *testing.T, opts mockGravatarOpts, callCounter *atomic.Int32) *httptest.Server {
	t.Helper()

	if opts.avatarBody == nil {
		opts.avatarBody = nonsenseBody
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCounter.Add(1)

		// Path is /avatar/<hash>
		hash := strings.TrimPrefix(r.URL.Path, "/avatar/")
		params := r.URL.RawQuery
		parsed, _ := url.ParseQuery(params)

		if parsed.Get("d") == "404" {
			// Custom-check request
			if opts.customHashes[hash] {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write(opts.avatarBody)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
			return
		}

		// Fetch request (d=retro)
		if opts.failFetch {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		_, _ = w.Write(opts.avatarBody)
	}))

	t.Cleanup(server.Close)

	return server
}

func newTestCfg(t *testing.T, gravatarURL string) *setting.Cfg {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.GravatarURL = gravatarURL
	cfg.DisableGravatar = false

	absPath, err := filepath.Abs("../../../public")
	require.NoError(t, err)

	cfg.StaticRootPath = absPath

	return cfg
}

func newTestAvatarServer(t *testing.T, avc *AvatarCacheServer) *webtest.Server {
	t.Helper()

	rr := routing.NewRouteRegister()
	rr.Get("/avatar/:hash", avc.Handler)

	return webtest.NewServer(t, rr)
}

func TestProvideAvatarCacheServer(t *testing.T) {
	t.Run("trims trailing slash from GravatarURL", func(t *testing.T) {
		cfg := newTestCfg(t, "https://example.com/avatar/")
		avc := ProvideAvatarCacheServer(cfg)
		assert.Equal(t, "https://example.com/avatar", avc.gravatarBaseURL)
	})

	t.Run("preserves URL without trailing slash", func(t *testing.T) {
		cfg := newTestCfg(t, "https://example.com/avatar")
		avc := ProvideAvatarCacheServer(cfg)
		assert.Equal(t, "https://example.com/avatar", avc.gravatarBaseURL)
	})

	t.Run("loads notFound avatar data from StaticRootPath", func(t *testing.T) {
		cfg := newTestCfg(t, "https://example.com/avatar")
		avc := ProvideAvatarCacheServer(cfg)
		assert.NotEmpty(t, avc.notFound.data, "notFound avatar should have image data loaded")
	})

	t.Run("notFound avatar has empty data when StaticRootPath is invalid", func(t *testing.T) {
		cfg := newTestCfg(t, "https://example.com/avatar")
		cfg.StaticRootPath = "/nonexistent/path"
		avc := ProvideAvatarCacheServer(cfg)
		assert.Empty(t, avc.notFound.data)
	})
}

func TestGetAvatarForHash_DisabledGravatar(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	cfg.DisableGravatar = true
	avc := ProvideAvatarCacheServer(cfg)

	avatar := avc.GetAvatarForHash(t.Context(), defaultHash)
	assert.Equal(t, avc.notFound, avatar)
	assert.Equal(t, int32(0), callCounter.Load(), "no HTTP calls should be made when gravatar is disabled")
}

func TestGetAvatarForHash_Retrieval(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	avatar := avc.getAvatarForHash(t.Context(), defaultHash)

	assert.Equal(t, nonsenseBody, avatar.data)
	assert.NotSame(t, avc.notFound, avatar)
	assert.False(t, avatar.isCustom, "default hash should not be marked custom")
	assert.Equal(t, int32(2), callCounter.Load(), "should make 2 HTTP calls: fetch + custom check")
}

func TestGetAvatarForHash_CustomAvatar(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{
		customHashes: map[string]bool{customHash: true},
	}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	avatar := avc.getAvatarForHash(t.Context(), customHash)

	assert.Equal(t, nonsenseBody, avatar.data)
	assert.True(t, avatar.isCustom, "hash in customHashes should be marked custom")
	assert.Equal(t, int32(2), callCounter.Load(), "should make 2 HTTP calls: fetch + custom check")
}

func TestGetAvatarForHash_CacheHit(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	first := avc.getAvatarForHash(t.Context(), defaultHash)
	require.Equal(t, int32(2), callCounter.Load())

	second := avc.getAvatarForHash(t.Context(), defaultHash)
	assert.Equal(t, int32(2), callCounter.Load(), "cached avatar should not trigger additional HTTP calls")
	assert.Same(t, first, second, "should return the same cached pointer")
}

func TestGetAvatarForHash_FetchErrorNotCached(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{failFetch: true}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	first := avc.getAvatarForHash(t.Context(), defaultHash)
	require.Same(t, avc.notFound, first)
	firstCount := callCounter.Load()

	second := avc.getAvatarForHash(t.Context(), defaultHash)
	assert.Same(t, avc.notFound, second)
	assert.Greater(t, callCounter.Load(), firstCount, "failed fetches should not be cached; retry should hit the server again")
}

func TestGetAvatarForHash_FetchError(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{failFetch: true}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	avatar := avc.getAvatarForHash(t.Context(), defaultHash)

	assert.Same(t, avc.notFound, avatar, "fetch error should return the notFound singleton")
	assert.Equal(t, int32(1), callCounter.Load(), "only the fetch call should be made; custom check is skipped on error")
}

func TestGetAvatarForHash_ContextCancellation(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	avatar := avc.getAvatarForHash(ctx, defaultHash)
	assert.Same(t, avc.notFound, avatar, "cancelled context should return notFound")
}

func TestGetAvatarForHash_DifferentHashes(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{
		customHashes: map[string]bool{customHash: true},
	}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)

	av1 := avc.getAvatarForHash(t.Context(), defaultHash)
	assert.Equal(t, int32(2), callCounter.Load())

	av2 := avc.getAvatarForHash(t.Context(), customHash)
	assert.Equal(t, int32(4), callCounter.Load(), "different hash should trigger new HTTP calls")

	assert.NotSame(t, av1, av2)
	assert.False(t, av1.isCustom)
	assert.True(t, av2.isCustom)

	// Re-fetch both from cache
	avc.getAvatarForHash(t.Context(), defaultHash)
	avc.getAvatarForHash(t.Context(), customHash)
	assert.Equal(t, int32(4), callCounter.Load(), "both hashes should be served from cache")
}

func TestHandler_ValidHash(t *testing.T) {
	t.Run("returns avatar data with correct headers", func(t *testing.T) {
		var callCounter atomic.Int32
		mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

		cfg := newTestCfg(t, mockServer.URL+"/avatar")
		avc := ProvideAvatarCacheServer(cfg)
		s := newTestAvatarServer(t, avc)

		req := s.NewGetRequest("/avatar/" + defaultHash)
		req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1})

		resp, err := s.Send(req)
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "image/jpeg", resp.Header.Get("Content-Type"))
		assert.Equal(t, "private, max-age=3600", resp.Header.Get("Cache-Control"))

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		assert.Equal(t, nonsenseBody, body)
	})
}

func TestHandler_GravatarDisabled(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	cfg.DisableGravatar = true
	avc := ProvideAvatarCacheServer(cfg)
	s := newTestAvatarServer(t, avc)

	req := s.NewGetRequest("/avatar/" + defaultHash)
	req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1})

	resp, err := s.Send(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "image/jpeg", resp.Header.Get("Content-Type"))
	assert.Equal(t, int32(0), callCounter.Load(), "no HTTP calls should be made to gravatar")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, avc.notFound.data, body, "should return the notFound fallback image")
}

func TestHandler_RemoteServerDown(t *testing.T) {
	var callCounter atomic.Int32
	mockServer := setupMockGravatarServer(t, mockGravatarOpts{failFetch: true}, &callCounter)

	cfg := newTestCfg(t, mockServer.URL+"/avatar")
	avc := ProvideAvatarCacheServer(cfg)
	s := newTestAvatarServer(t, avc)

	req := s.NewGetRequest("/avatar/" + defaultHash)
	req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1})

	resp, err := s.Send(req)
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "handler should return 200 with fallback image, not propagate the error")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, avc.notFound.data, body, "should return the notFound fallback image")
}
