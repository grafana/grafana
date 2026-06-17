package api

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsapi"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

// stubAnnotationsRepo is a minimal fake for annotations.Repository with controllable Find results.
type stubAnnotationsRepo struct {
	findItems []*annotations.ItemDTO
}

func (r *stubAnnotationsRepo) Find(_ context.Context, _ *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return r.findItems, nil
}
func (r *stubAnnotationsRepo) Save(_ context.Context, _ *annotations.Item) error      { return nil }
func (r *stubAnnotationsRepo) SaveMany(_ context.Context, _ []annotations.Item) error { return nil }
func (r *stubAnnotationsRepo) Update(_ context.Context, _ *annotations.Item) error    { return nil }
func (r *stubAnnotationsRepo) Delete(_ context.Context, _ *annotations.DeleteParams) error {
	return nil
}
func (r *stubAnnotationsRepo) FindTags(_ context.Context, _ *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, nil
}

// fakeAnnotationProxy is a controllable fake for annotationProxy.
type fakeAnnotationProxy struct {
	items  []*annotations.ItemDTO
	err    error
	called bool // set when any proxy operation method is invoked
}

func (f *fakeAnnotationProxy) List(_ context.Context, _ int64, _ *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return f.items, f.err
}

func (f *fakeAnnotationProxy) Create(_ context.Context, _ int64, _ *annotations.Item) (int64, error) {
	f.called = true
	return 0, f.err
}

func (f *fakeAnnotationProxy) Update(_ context.Context, _ int64, _ int64, _ *annotations.Item) error {
	f.called = true
	return f.err
}

func (f *fakeAnnotationProxy) Delete(_ context.Context, _ int64, _ int64) error {
	f.called = true
	return f.err
}

func (f *fakeAnnotationProxy) Get(_ context.Context, _ int64, _ int64) (*annotations.ItemDTO, error) {
	f.called = true
	if f.err != nil {
		return nil, f.err
	}
	if len(f.items) > 0 {
		return f.items[0], nil
	}
	return nil, annotationsapi.ErrNotFound
}

func TestFindAnnotations(t *testing.T) {
	tests := []struct {
		name        string
		phase       string
		proxy       annotationProxy
		legacyItems []*annotations.ItemDTO
		query       *annotations.ItemQuery
		expectedIDs []int64
	}{
		{
			name:        "proxy disabled - uses legacy",
			phase:       "off",
			proxy:       &fakeAnnotationProxy{},
			legacyItems: []*annotations.ItemDTO{{ID: 42}},
			query:       &annotations.ItemQuery{OrgID: 1},
			expectedIDs: []int64{42},
		},
		{
			name:        "alert query bypasses proxy even when enabled",
			phase:       "proxy-writes",
			proxy:       &fakeAnnotationProxy{items: []*annotations.ItemDTO{{ID: 10}}},
			legacyItems: []*annotations.ItemDTO{{ID: 42}},
			query:       &annotations.ItemQuery{OrgID: 1, Type: "alert"},
			expectedIDs: []int64{42},
		},
		{
			name:  "proxy-writes: deduplicates overlapping IDs (2 not 3)",
			phase: "proxy-writes",
			proxy: &fakeAnnotationProxy{
				items: []*annotations.ItemDTO{{ID: 10, TimeEnd: 20}, {ID: 42, TimeEnd: 5}},
			},
			legacyItems: []*annotations.ItemDTO{{ID: 42}},
			query:       &annotations.ItemQuery{OrgID: 1},
			expectedIDs: []int64{10, 42},
		},
		{
			name:        "proxy-all - new store only, legacy not queried",
			phase:       "proxy-all",
			proxy:       &fakeAnnotationProxy{items: []*annotations.ItemDTO{{ID: 10}}},
			legacyItems: []*annotations.ItemDTO{{ID: 42}},
			query:       &annotations.ItemQuery{OrgID: 1},
			expectedIDs: []int64{10},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AnnotationAppPlatform.APIMigrationPhase = tt.phase
			hs := &HTTPServer{
				Cfg:                      cfg,
				annotationMigrationProxy: tt.proxy,
				annotationsRepo:          &stubAnnotationsRepo{findItems: tt.legacyItems},
			}
			items, err := hs.findAnnotations(context.Background(), tt.query)
			require.NoError(t, err)
			ids := make([]int64, len(items))
			for i, item := range items {
				ids[i] = item.ID
			}
			require.Equal(t, tt.expectedIDs, ids)
		})
	}
}

func TestGetAnnotationByID_ProxyFallthrough(t *testing.T) {
	readPerm := accesscontrol.Permission{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}

	tests := []struct {
		name       string
		phase      string
		proxyErr   error
		wantStatus int
	}{
		{
			name:       "proxy-writes ErrNotFound falls through to legacy - 200",
			phase:      "proxy-writes",
			proxyErr:   annotationsapi.ErrNotFound,
			wantStatus: http.StatusOK,
		},
		{
			name:       "proxy-all ErrNotFound returns 404 - no legacy fallback",
			phase:      "proxy-all",
			proxyErr:   annotationsapi.ErrNotFound,
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "proxy internal error returns 500 - no legacy fallback",
			phase:      "proxy-writes",
			proxyErr:   errors.New("unexpected"),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			proxy := &fakeAnnotationProxy{err: tt.proxyErr}
			server := newProxyWriteServer(t, proxy, tt.phase)

			req := webtest.RequestWithSignedInUser(
				server.NewRequest(http.MethodGet, "/api/annotations/1", nil),
				authedUserWithPermissions(1, 1, []accesscontrol.Permission{readPerm}),
			)

			res, err := server.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tt.wantStatus, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAnnotationWriteHandlers_Proxy(t *testing.T) {
	var (
		createPerm = accesscontrol.Permission{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}
		writePerm  = accesscontrol.Permission{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsAll}
		deletePerm = accesscontrol.Permission{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsAll}
	)

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		proxy      *fakeAnnotationProxy
		perm       accesscontrol.Permission
		wantStatus int
	}{
		// POST /api/annotations
		{name: "PostAnnotation: proxy succeeds - 200", method: http.MethodPost, path: "/api/annotations", body: `{"text":"hello"}`, proxy: &fakeAnnotationProxy{}, perm: createPerm, wantStatus: http.StatusOK},
		{name: "PostAnnotation: proxy error - 500", method: http.MethodPost, path: "/api/annotations", body: `{"text":"hello"}`, proxy: &fakeAnnotationProxy{err: errors.New("x")}, perm: createPerm, wantStatus: http.StatusInternalServerError},
		// PUT /api/annotations/1
		{name: "UpdateAnnotation: proxy succeeds - 200", method: http.MethodPut, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{}, perm: writePerm, wantStatus: http.StatusOK},
		{name: "UpdateAnnotation: ErrNotFound falls through to legacy - 200", method: http.MethodPut, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{err: annotationsapi.ErrNotFound}, perm: writePerm, wantStatus: http.StatusOK},
		{name: "UpdateAnnotation: proxy error - 500", method: http.MethodPut, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{err: errors.New("x")}, perm: writePerm, wantStatus: http.StatusInternalServerError},
		// PATCH /api/annotations/1
		{name: "PatchAnnotation: proxy succeeds - 200", method: http.MethodPatch, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{items: []*annotations.ItemDTO{{ID: 1}}}, perm: writePerm, wantStatus: http.StatusOK},
		{name: "PatchAnnotation: ErrNotFound falls through to legacy - 200", method: http.MethodPatch, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{err: annotationsapi.ErrNotFound}, perm: writePerm, wantStatus: http.StatusOK},
		{name: "PatchAnnotation: proxy error - 500", method: http.MethodPatch, path: "/api/annotations/1", body: `{"text":"x"}`, proxy: &fakeAnnotationProxy{err: errors.New("x")}, perm: writePerm, wantStatus: http.StatusInternalServerError},
		// DELETE /api/annotations/1
		{name: "DeleteAnnotation: proxy succeeds - 200", method: http.MethodDelete, path: "/api/annotations/1", proxy: &fakeAnnotationProxy{}, perm: deletePerm, wantStatus: http.StatusOK},
		{name: "DeleteAnnotation: ErrNotFound falls through to legacy - 200", method: http.MethodDelete, path: "/api/annotations/1", proxy: &fakeAnnotationProxy{err: annotationsapi.ErrNotFound}, perm: deletePerm, wantStatus: http.StatusOK},
		{name: "DeleteAnnotation: proxy error - 500", method: http.MethodDelete, path: "/api/annotations/1", proxy: &fakeAnnotationProxy{err: errors.New("x")}, perm: deletePerm, wantStatus: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := newProxyWriteServer(t, tt.proxy, "proxy-writes")
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}
			req := webtest.RequestWithSignedInUser(
				server.NewRequest(tt.method, tt.path, body),
				authedUserWithPermissions(1, 1, []accesscontrol.Permission{tt.perm}),
			)
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			require.True(t, tt.proxy.called, "proxy operation method should have been invoked")
			require.Equal(t, tt.wantStatus, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

// newProxyWriteServer sets up a test server with annotation ID 1 pre-saved for Update/Patch fallthrough paths.
func newProxyWriteServer(t *testing.T, proxy annotationProxy, phase string) *webtest.Server {
	t.Helper()
	repo := annotationstest.NewFakeAnnotationsRepo()
	require.NoError(t, repo.Save(context.Background(), &annotations.Item{ID: 1}))
	return SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.Cfg.AnnotationAppPlatform.APIMigrationPhase = phase
		hs.annotationsRepo = repo
		hs.annotationMigrationProxy = proxy
	})
}
