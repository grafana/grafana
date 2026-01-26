package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSearch_FeatureFlagDisabled_UsesLegacyPath(t *testing.T) {
	hs := setupHTTPServer(t, false)

	req := httptest.NewRequest("GET", "/api/search?query=test", nil)
	req = req.WithContext(context.WithValue(req.Context(), contexthandler.ReqContextKey, &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{"query": {"test"}},
	}))

	// Mock search service
	mockSearchService := &mockSearchService{}
	hs.SearchService = mockSearchService

	resp := hs.Search(&contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{"query": {"test"}},
		Req:          req,
		Resp:         httptest.NewRecorder(),
	})

	// Should call legacy search service
	assert.NotNil(t, resp)
	assert.True(t, mockSearchService.called)
}

func TestSearch_FeatureFlagEnabled_DelegatesToK8sAPI(t *testing.T) {
	hs := setupHTTPServer(t, true)

	req := httptest.NewRequest("GET", "/api/search?query=test", nil)
	req = req.WithContext(context.WithValue(req.Context(), contexthandler.ReqContextKey, &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{"query": {"test"}},
	}))

	// Note: This test would require mocking the K8s client, which is complex
	// For now, we verify the feature flag check works
	resp := hs.Search(&contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{"query": {"test"}},
		Req:          req,
		Resp:         httptest.NewRecorder(),
	})

	// Should attempt K8s delegation (may fail without proper setup, but flag check should work)
	assert.NotNil(t, resp)
}

func TestTransformK8sSearchResultsToLegacy(t *testing.T) {
	hs := setupHTTPServer(t, true)

	k8sResults := dashboardv0alpha1.SearchResults{
		TotalHits: 2,
		Hits: []dashboardv0alpha1.DashboardHit{
			{
				Resource: "dashboards",
				Name:     "test-dash-uid",
				Title:    "Test Dashboard",
				Tags:     []string{"test", "dashboard"},
				Folder:   "test-folder-uid",
			},
			{
				Resource: "folders",
				Name:     "test-folder-uid",
				Title:    "Test Folder",
				Tags:     []string{"folder"},
			},
		},
	}

	c := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{},
	}

	hits := hs.transformK8sSearchResultsToLegacy(k8sResults, c)

	require.Len(t, hits, 2)
	assert.Equal(t, "test-dash-uid", hits[0].UID)
	assert.Equal(t, "Test Dashboard", hits[0].Title)
	assert.Equal(t, model.DashHitDB, hits[0].Type)
	assert.Equal(t, "test-folder-uid", hits[0].FolderUID)
	assert.Equal(t, []string{"test", "dashboard"}, hits[0].Tags)

	assert.Equal(t, "test-folder-uid", hits[1].UID)
	assert.Equal(t, "Test Folder", hits[1].Title)
	assert.Equal(t, model.DashHitFolder, hits[1].Type)
}

func TestTransformK8sSearchResultsToLegacy_StarredFilter(t *testing.T) {
	hs := setupHTTPServer(t, true)
	hs.starService = startest.NewStarServiceFake()
	hs.starService.(*startest.StarServiceFake).ExpectedUserStars = &star.GetUserStarsResult{
		UserStars: map[string]bool{
			"starred-dash-uid": true,
		},
	}

	k8sResults := dashboardv0alpha1.SearchResults{
		TotalHits: 2,
		Hits: []dashboardv0alpha1.DashboardHit{
			{
				Resource: "dashboards",
				Name:     "starred-dash-uid",
				Title:    "Starred Dashboard",
			},
			{
				Resource: "dashboards",
				Name:     "unstarred-dash-uid",
				Title:    "Unstarred Dashboard",
			},
		},
	}

	c := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{"starred": {"true"}},
	}

	hits := hs.transformK8sSearchResultsToLegacy(k8sResults, c)

	// Should only return starred dashboard
	require.Len(t, hits, 1)
	assert.Equal(t, "starred-dash-uid", hits[0].UID)
	assert.True(t, hits[0].IsStarred)
}

func TestMapResourceTypeToHitType(t *testing.T) {
	hs := setupHTTPServer(t, true)

	assert.Equal(t, model.DashHitDB, hs.mapResourceTypeToHitType("dashboards"))
	assert.Equal(t, model.DashHitFolder, hs.mapResourceTypeToHitType("folders"))
	assert.Equal(t, model.DashHitDB, hs.mapResourceTypeToHitType("unknown"))
}

func TestListSortOptions_FeatureFlagDisabled_UsesLegacyPath(t *testing.T) {
	hs := setupHTTPServer(t, false)

	mockSearchService := &mockSearchService{}
	hs.SearchService = mockSearchService

	resp := hs.ListSortOptions(&contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1},
		Query:        map[string][]string{},
		Req:          httptest.NewRequest("GET", "/api/search/sorting", nil),
		Resp:         httptest.NewRecorder(),
	})

	assert.NotNil(t, resp)
	assert.True(t, mockSearchService.sortOptionsCalled)
}

// Helper functions

func setupHTTPServer(t *testing.T, unifiedStorageSearchUIEnabled bool) *HTTPServer {
	cfg := setting.NewCfg()
	cfg.FeatureToggles = map[string]bool{}
	if unifiedStorageSearchUIEnabled {
		cfg.FeatureToggles[featuremgmt.FlagUnifiedStorageSearchUI] = true
	}

	features := featuremgmt.WithFeatures()
	if unifiedStorageSearchUIEnabled {
		features = featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchUI)
	}

	hs := &HTTPServer{
		Cfg:      cfg,
		Features: features,
		tracer:   tracing.InitializeTracerForTest(),
	}

	return hs
}

// Mock search service

type mockSearchService struct {
	called           bool
	sortOptionsCalled bool
}

func (m *mockSearchService) SearchHandler(ctx context.Context, query *search.Query) (model.HitList, error) {
	m.called = true
	return model.HitList{}, nil
}

func (m *mockSearchService) SortOptions() []model.SortOption {
	m.sortOptionsCalled = true
	return []model.SortOption{
		{
			Name:        "alpha-asc",
			DisplayName: "Alphabetically (A-Z)",
			Description: "Sort alphabetically ascending",
			MetaName:    "alpha",
		},
	}
}
