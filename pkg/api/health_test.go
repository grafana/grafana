package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestHealthAPI_Version(t *testing.T) {
	m, _ := setupHealthAPITestEnvironment(t, func(cfg *setting.Cfg) {
		cfg.BuildVersion = "7.4.0"
		cfg.BuildCommit = "59906ab1bf"
	})

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 200, rec.Code)
	expectedBody := `
		{
			"database": "ok",
			"version": "7.4.0",
			"commit": "59906ab1bf"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())
}

func TestHealthAPI_VersionEnterprise(t *testing.T) {
	m, _ := setupHealthAPITestEnvironment(t, func(cfg *setting.Cfg) {
		cfg.BuildVersion = "7.4.0"
		cfg.EnterpriseBuildCommit = "22206ab1be"
		cfg.BuildCommit = "59906ab1bf"
	})

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 200, rec.Code)
	expectedBody := `
		{
			"database": "ok",
			"enterpriseCommit": "22206ab1be",
			"version": "7.4.0",
			"commit": "59906ab1bf"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())
}

func TestHealthAPI_AnonymousHideVersion(t *testing.T) {
	m, hs := setupHealthAPITestEnvironment(t)
	hs.Cfg.Get().Anonymous.HideVersion = true

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 200, rec.Code)
	expectedBody := `
		{
			"database": "ok"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())
}

func TestHealthAPI_DatabaseHealthy(t *testing.T) {
	const cacheKey = "db-healthy"

	m, hs := setupHealthAPITestEnvironment(t)
	hs.Cfg.Get().Anonymous.HideVersion = true

	healthy, found := hs.CacheService.Get(cacheKey)
	require.False(t, found)
	require.Nil(t, healthy)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 200, rec.Code)
	expectedBody := `
		{
			"database": "ok"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())

	healthy, found = hs.CacheService.Get(cacheKey)
	require.True(t, found)
	require.True(t, healthy.(bool))
}

func TestHealthAPI_DatabaseUnhealthy(t *testing.T) {
	const cacheKey = "db-healthy"

	m, hs := setupHealthAPITestEnvironment(t)
	hs.Cfg.Get().Anonymous.HideVersion = true
	hs.SQLStore.(*dbtest.FakeDB).ExpectedError = errors.New("bad")

	healthy, found := hs.CacheService.Get(cacheKey)
	require.False(t, found)
	require.Nil(t, healthy)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 503, rec.Code)
	expectedBody := `
		{
			"database": "failing"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())

	healthy, found = hs.CacheService.Get(cacheKey)
	require.True(t, found)
	require.False(t, healthy.(bool))
}

func TestHealthAPI_DatabaseHealthCached(t *testing.T) {
	const cacheKey = "db-healthy"

	m, hs := setupHealthAPITestEnvironment(t)
	hs.Cfg.Get().Anonymous.HideVersion = true

	// Mock unhealthy database in cache.
	hs.CacheService.Set(cacheKey, false, 5*time.Minute)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 503, rec.Code)
	expectedBody := `
		{
			"database": "failing"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())

	// Purge cache and redo request.
	hs.CacheService.Delete(cacheKey)
	rec = httptest.NewRecorder()
	m.ServeHTTP(rec, req)

	require.Equal(t, 200, rec.Code)
	expectedBody = `
		{
			"database": "ok"
		}
	`
	require.JSONEq(t, expectedBody, rec.Body.String())

	healthy, found := hs.CacheService.Get(cacheKey)
	require.True(t, found)
	require.True(t, healthy.(bool))
}

func setupHealthAPITestEnvironment(t *testing.T, cbs ...func(*setting.Cfg)) (*web.Mux, *HTTPServer) {
	t.Helper()

	m := web.New()
	cfg := setting.NewCfg()
	for _, cb := range cbs {
		cb(cfg)
	}
	hs := &HTTPServer{
		CacheService: localcache.New(5*time.Minute, 10*time.Minute),
		Cfg:          setting.ProvideService(cfg),
		SQLStore:     dbtest.NewFakeDB(),
	}

	m.Get("/api/health", hs.apiHealthHandler)
	return m, hs
}
