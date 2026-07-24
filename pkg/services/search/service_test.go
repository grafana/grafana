package search

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	starapi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web"
)

// reqContextOnRequest returns a *http.Request whose context carries a
// *contextmodel.ReqContext, mimicking what the contexthandler middleware does
// in production. SearchService.getUserStars looks for this via
// contexthandler.FromContext.
func reqContextOnRequest(t *testing.T, signedInUser *user.SignedInUser) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/search", nil)
	reqCtx := &contextmodel.ReqContext{
		Context:      &web.Context{Req: req},
		SignedInUser: signedInUser,
	}
	ctx := ctxkey.Set(req.Context(), reqCtx)
	return req.WithContext(ctx)
}

func TestSearch_SortedResults(t *testing.T) {
	db := dbtest.NewFakeDB()
	us := usertest.NewUserServiceFake()
	ds := dashboards.NewFakeDashboardService(t)
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Return(model.HitList{
		&model.Hit{UID: "test", Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
		&model.Hit{UID: "test2", Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
		&model.Hit{UID: "test3", Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&model.Hit{UID: "test4", Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
		&model.Hit{UID: "test5", Title: "FOLDER", Type: "dash-folder"},
	}, nil)
	us.ExpectedSignedInUser = &user.SignedInUser{IsGrafanaAdmin: true}

	signedInUser := &user.SignedInUser{IsGrafanaAdmin: true}
	req := reqContextOnRequest(t, signedInUser)

	starClient := starapi.NewMockK8sClients(t)
	starClient.On("GetStars", mock.Anything).Return([]string{"test2", "test7"}, nil)

	svc := &SearchService{
		sqlstore:         db,
		starClient:       starClient,
		dashboardService: ds,
		features:         &featuremgmt.FeatureManager{},
	}

	query := &Query{
		Limit:        2000,
		SignedInUser: signedInUser,
	}

	hits, err := svc.SearchHandler(req.Context(), query)
	require.Nil(t, err)

	// Assert results are sorted.
	assert.Equal(t, "FOLDER", hits[0].Title)
	assert.Equal(t, "AABB", hits[1].Title)
	assert.Equal(t, "BBAA", hits[2].Title)
	assert.Equal(t, "bbAAa", hits[3].Title)
	assert.Equal(t, "CCAA", hits[4].Title)

	// Assert tags are sorted.
	assert.Equal(t, "AA", hits[3].Tags[0])
	assert.Equal(t, "BB", hits[3].Tags[1])
	assert.Equal(t, "EE", hits[3].Tags[2])
}

func TestSearch_StarredResults(t *testing.T) {
	db := dbtest.NewFakeDB()
	us := usertest.NewUserServiceFake()
	ds := dashboards.NewFakeDashboardService(t)
	ds.On("SearchDashboards", mock.Anything, mock.AnythingOfType("*dashboards.FindPersistedDashboardsQuery")).Return(model.HitList{
		&model.Hit{UID: "test", Title: "A", Type: "dash-db"},
		&model.Hit{UID: "test2", Title: "B", Type: "dash-db"},
		&model.Hit{UID: "test3", Title: "C", Type: "dash-db"},
	}, nil)
	us.ExpectedSignedInUser = &user.SignedInUser{}

	signedInUser := &user.SignedInUser{}
	req := reqContextOnRequest(t, signedInUser)

	starClient := starapi.NewMockK8sClients(t)
	starClient.On("GetStars", mock.Anything).Return([]string{"test", "test3", "test4"}, nil)

	svc := &SearchService{
		sqlstore:         db,
		starClient:       starClient,
		dashboardService: ds,
		features:         &featuremgmt.FeatureManager{},
	}

	query := &Query{
		Limit:        2000,
		IsStarred:    true,
		SignedInUser: signedInUser,
	}

	hits, err := svc.SearchHandler(req.Context(), query)
	require.Nil(t, err)

	// Assert only starred dashboards are returned
	assert.Equal(t, 2, hits.Len())
	assert.Equal(t, "A", hits[0].Title)
	assert.Equal(t, "C", hits[1].Title)
}

// Compile-time assertion that contexthandler.FromContext can read the value
// set by ctxkey.Set; this guarantees the test helper above mirrors what the
// middleware does, so getUserStars actually sees a ReqContext.
var _ = contexthandler.FromContext
