package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
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
		{"valid matchers equality", `matchers={severity="critical"}`, http.StatusOK},
		{"valid matchers regex", `matchers={severity=~"crit.*"}`, http.StatusOK},
		{"valid matchers not-equal", `matchers={env!="prod"}`, http.StatusOK},
		{"valid matchers not-regex", `matchers={env!~"prod.*"}`, http.StatusOK},
		{"invalid matchers regex", `matchers={severity=~"[invalid"}`, http.StatusBadRequest},
		{"invalid matchers syntax", `matchers=not_a_selector`, http.StatusBadRequest},
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

	labelParamCases := []struct {
		name         string
		values       url.Values
		expectedCode int
	}{
		{
			name:         "valid labels_ not-equal",
			values:       url.Values{"labels_severity": {`!="critical"`}},
			expectedCode: http.StatusOK,
		},
		{
			name:         "valid labels_ regex",
			values:       url.Values{"labels_severity": {`=~"crit.*"`}},
			expectedCode: http.StatusOK,
		},
		{
			name:         "valid labels_ not-regex",
			values:       url.Values{"labels_env": {`!~"prod.*"`}},
			expectedCode: http.StatusOK,
		},
		{
			name:         "valid labels_ explicit equal",
			values:       url.Values{"labels_env": {`="prod"`}},
			expectedCode: http.StatusOK,
		},
		{
			name:         "invalid labels_ regex",
			values:       url.Values{"labels_severity": {`=~"[invalid"`}},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range labelParamCases {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/?"+tt.values.Encode(), nil)
			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{OrgID: 1},
			}
			resp := srv.RouteQueryStateHistory(c)
			assert.Equal(t, tt.expectedCode, resp.Status())
		})
	}
}

func TestParseHistoryQuery(t *testing.T) {
	t.Run("labels_ prefix produces MatchEqual matchers", func(t *testing.T) {
		q := url.Values{
			"labels_severity": {"critical"},
			"labels_env":      {"prod"},
		}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		require.Len(t, result.Labels, 2)

		byName := matchersByName(result.Labels)
		require.Equal(t, labels.MatchEqual, byName["severity"].Type)
		require.Equal(t, "critical", byName["severity"].Value)
		require.Equal(t, labels.MatchEqual, byName["env"].Type)
		require.Equal(t, "prod", byName["env"].Value)
	})

	t.Run("labels_ prefix supports comparison operators", func(t *testing.T) {
		q := url.Values{
			"labels_severity": {`!="critical"`},
			"labels_region":   {`=~"us-.*"`},
			"labels_zone":     {`!~"eu-.*"`},
			"labels_team":     {`="alerting"`},
		}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		require.Len(t, result.Labels, 4)

		byName := matchersByName(result.Labels)
		assert.Equal(t, labels.MatchNotEqual, byName["severity"].Type)
		assert.Equal(t, "critical", byName["severity"].Value)
		assert.Equal(t, labels.MatchRegexp, byName["region"].Type)
		assert.Equal(t, "us-.*", byName["region"].Value)
		assert.Equal(t, labels.MatchNotRegexp, byName["zone"].Type)
		assert.Equal(t, "eu-.*", byName["zone"].Value)
		assert.Equal(t, labels.MatchEqual, byName["team"].Type)
		assert.Equal(t, "alerting", byName["team"].Value)
	})

	t.Run("invalid regex in labels_ returns error", func(t *testing.T) {
		q := url.Values{"labels_severity": {`=~"[invalid"`}}
		_, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid label filter")
	})

	t.Run("labels_ without name returns error", func(t *testing.T) {
		q := url.Values{"labels_": {"foo"}}
		_, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid label filter")
	})

	t.Run("labels_ without value returns error", func(t *testing.T) {
		q := url.Values{"labels_severity": {}}
		_, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "missing value for label filter")
	})

	t.Run("matchers param supports all operators", func(t *testing.T) {
		q := url.Values{
			"matchers": {`{severity=~"crit.*",env!="dev",team="alerting",zone!~"us-.*"}`},
		}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		require.Len(t, result.Labels, 4)

		byName := matchersByName(result.Labels)
		assert.Equal(t, labels.MatchRegexp, byName["severity"].Type)
		assert.Equal(t, "crit.*", byName["severity"].Value)
		assert.Equal(t, labels.MatchNotEqual, byName["env"].Type)
		assert.Equal(t, "dev", byName["env"].Value)
		assert.Equal(t, labels.MatchEqual, byName["team"].Type)
		assert.Equal(t, "alerting", byName["team"].Value)
		assert.Equal(t, labels.MatchNotRegexp, byName["zone"].Type)
		assert.Equal(t, "us-.*", byName["zone"].Value)
	})

	t.Run("matchers param can be specified multiple times", func(t *testing.T) {
		q := url.Values{
			"matchers": {`{severity="critical"}`, `{env!="dev"}`},
		}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		require.Len(t, result.Labels, 2)
	})

	t.Run("labels_ and matchers params are merged", func(t *testing.T) {
		q := url.Values{
			"labels_severity": {"critical"},
			"matchers":        {`{env=~"prod.*"}`},
		}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		require.Len(t, result.Labels, 2)

		byName := matchersByName(result.Labels)
		assert.Equal(t, labels.MatchEqual, byName["severity"].Type)
		assert.Equal(t, labels.MatchRegexp, byName["env"].Type)
	})

	t.Run("invalid regex in matchers returns error", func(t *testing.T) {
		q := url.Values{
			"matchers": {`{severity=~"[invalid"}`},
		}
		_, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid matchers")
	})

	t.Run("invalid matchers syntax returns error", func(t *testing.T) {
		q := url.Values{
			"matchers": {"not_a_selector"},
		}
		_, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid matchers")
	})

	t.Run("no labels produces nil matchers", func(t *testing.T) {
		q := url.Values{"ruleUID": {"abc123"}}
		result, err := ParseHistoryQuery(1, &user.SignedInUser{}, q)
		require.NoError(t, err)
		assert.Empty(t, result.Labels)
	})
}

// matchersByName indexes a Matchers slice by label name for easy lookup in tests.
func matchersByName(ms labels.Matchers) map[string]*labels.Matcher {
	out := make(map[string]*labels.Matcher, len(ms))
	for _, m := range ms {
		out[m.Name] = m
	}
	return out
}
