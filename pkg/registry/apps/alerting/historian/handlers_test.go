package historian

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type mockHistorian struct {
	queryFunc func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error)
}

func (m *mockHistorian) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, query)
	}
	return nil, errors.New("not implemented")
}

type mockResponseWriter struct {
	*httptest.ResponseRecorder
	headers http.Header
}

func newMockResponseWriter() *mockResponseWriter {
	return &mockResponseWriter{
		ResponseRecorder: httptest.NewRecorder(),
		headers:          make(http.Header),
	}
}

func (m *mockResponseWriter) Header() http.Header {
	return m.headers
}

func TestGetAlertStateHistoryHandler(t *testing.T) {
	t.Run("returns data frame when query succeeds", func(t *testing.T) {
		now := time.Now()
		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{now, now.Add(time.Second)}),
			data.NewField("Line", nil, []string{"alert fired", "alert resolved"}),
		)

		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				assert.Equal(t, int64(123), query.OrgID)
				assert.NotNil(t, query.SignedInUser)
				return testFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			OrgID: 123,
		})

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: ""},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, writer.Code)
		assert.Equal(t, "application/json", writer.headers.Get("Content-Type"))

		var result *data.Frame
		err = json.Unmarshal(writer.Body.Bytes(), &result)
		require.NoError(t, err)
		assert.Equal(t, "test", result.Name)
		assert.Equal(t, 2, result.Rows())
	})

	t.Run("passes query parameters to historian", func(t *testing.T) {
		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{time.Now()}),
			data.NewField("Line", nil, []string{"test"}),
		)

		var capturedQuery models.HistoryQuery
		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				capturedQuery = query
				return testFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 99})

		params := url.Values{}
		params.Set("ruleUID", "rule-123")
		params.Set("dashboardUID", "dash-456")
		params.Set("panelID", "7")
		params.Set("from", "1000")
		params.Set("to", "2000")
		params.Set("limit", "50")

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: params.Encode()},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		assert.Equal(t, "rule-123", capturedQuery.RuleUID)
		assert.Equal(t, "dash-456", capturedQuery.DashboardUID)
		assert.Equal(t, int64(7), capturedQuery.PanelID)
		assert.Equal(t, time.Unix(1000, 0), capturedQuery.From)
		assert.Equal(t, time.Unix(2000, 0), capturedQuery.To)
		assert.Equal(t, 50, capturedQuery.Limit)
	})

	t.Run("handles label matchers in query", func(t *testing.T) {
		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{time.Now()}),
			data.NewField("Line", nil, []string{"test"}),
		)

		var capturedQuery models.HistoryQuery
		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				capturedQuery = query
				return testFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

		params := url.Values{}
		params.Add("labels", `env=prod`)
		params.Add("labels", `region=us-west`)

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: params.Encode()},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		if len(capturedQuery.Labels) > 0 {
			assert.NotEmpty(t, capturedQuery.Labels)
		}
	})

	t.Run("returns unauthorized when no user in context", func(t *testing.T) {
		h := handlers{historian: &mockHistorian{}}
		ctx := context.Background()

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: ""},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "authentication required")
	})

	t.Run("returns internal error when historian query fails", func(t *testing.T) {
		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				return nil, errors.New("database connection failed")
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: ""},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "database connection failed")
	})

	t.Run("returns empty frame when no results", func(t *testing.T) {
		emptyFrame := data.NewFrame("empty")

		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				return emptyFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: ""},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, writer.Code)

		var result *data.Frame
		err = json.Unmarshal(writer.Body.Bytes(), &result)
		require.NoError(t, err)
		assert.Equal(t, 0, result.Rows())
	})

	t.Run("encodes complex data frame with multiple fields", func(t *testing.T) {
		now := time.Now()
		complexFrame := data.NewFrame("complex",
			data.NewField("Time", nil, []time.Time{now}),
			data.NewField("Line", nil, []string{"alert fired"}),
			data.NewField("Value", nil, []float64{42.5}),
			data.NewField("Labels", nil, []string{`{"env":"prod"}`}),
		)

		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				return complexFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: ""},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, writer.Code)

		var result *data.Frame
		err = json.Unmarshal(writer.Body.Bytes(), &result)
		require.NoError(t, err)
		assert.Equal(t, 4, len(result.Fields))
		assert.Equal(t, 1, result.Rows())
	})
}

func TestParseHistoryQueryIntegration(t *testing.T) {
	t.Run("parses all supported query parameters", func(t *testing.T) {
		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{time.Now()}),
			data.NewField("Line", nil, []string{"test"}),
		)

		var capturedQuery models.HistoryQuery
		mock := &mockHistorian{
			queryFunc: func(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
				capturedQuery = query
				return testFrame, nil
			},
		}

		h := handlers{historian: mock}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 5})

		params := url.Values{}
		params.Set("ruleUID", "test-rule")
		params.Set("dashboardUID", "test-dash")
		params.Set("panelID", "3")
		params.Set("from", "1609459200")
		params.Set("to", "1609545600")
		params.Set("limit", "100")
		params.Set("current", "alerting")
		params.Set("previous", "normal")

		writer := newMockResponseWriter()
		req := &app.CustomRouteRequest{
			URL: &url.URL{RawQuery: params.Encode()},
		}

		err := h.GetAlertStateHistoryHandler(ctx, writer, req)

		require.NoError(t, err)
		assert.Equal(t, int64(5), capturedQuery.OrgID)
		assert.Equal(t, "test-rule", capturedQuery.RuleUID)
		assert.Equal(t, "test-dash", capturedQuery.DashboardUID)
		assert.Equal(t, int64(3), capturedQuery.PanelID)
		assert.Equal(t, time.Unix(1609459200, 0), capturedQuery.From)
		assert.Equal(t, time.Unix(1609545600, 0), capturedQuery.To)
		assert.Equal(t, 100, capturedQuery.Limit)
		assert.Equal(t, "alerting", capturedQuery.Current)
		assert.Equal(t, "normal", capturedQuery.Previous)
	})
}
