package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type mockHistorian struct{}

func (m *mockHistorian) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	return &data.Frame{Name: "history"}, nil
}

func TestRouteQueryStateHistory(t *testing.T) {
	testCases := []struct {
		name         string
		queryParams  string
		expectedCode int
	}{
		{"valid states", "previous=Normal&current=Alerting", http.StatusOK},
		{"invalid previous", "previous=InvalidState", http.StatusBadRequest},
		{"invalid current", "current=InvalidState", http.StatusBadRequest},
	}

	srv := &HistorySrv{
		logger: log.NewNopLogger(),
		hist:   &mockHistorian{},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.queryParams, nil)

			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{OrgID: 1},
			}

			resp := srv.RouteQueryStateHistory(c)

			assert.Equal(t, tt.expectedCode, resp.Status())
		})
	}
}
