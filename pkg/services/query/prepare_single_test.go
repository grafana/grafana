package query

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestPrepareSingleDatasourceRequest(t *testing.T) {
	dscache := &fakeDataSourceCache{cache: []*datasources.DataSource{
		{UID: "ds1", Type: "prometheus"},
		{UID: "ds2", Type: "loki"},
	}}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1})

	query := func(t *testing.T, js string) *simplejson.Json {
		t.Helper()
		q, err := simplejson.NewJson([]byte(js))
		require.NoError(t, err)
		return q
	}
	ds1A := `{"refId": "A", "datasource": {"uid": "ds1"}, "expr": "up"}`

	t.Run("prepares a single query to a single datasource", func(t *testing.T) {
		now := time.Now()
		reqDTO := dtos.MetricRequest{From: "now-1h", To: "now", Queries: []*simplejson.Json{query(t, ds1A)}}

		k8sReq, ds, ok, err := PrepareSingleDatasourceRequest(ctx, log.NewNopLogger(), dscache, reqDTO, nil)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, "ds1", ds.UID)
		require.Len(t, k8sReq.Queries, 1)

		q := k8sReq.Queries[0]
		require.Equal(t, "A", q.RefID)
		require.Equal(t, "up", q.GetString("expr"))
		// relative times are resolved to absolute ones, as on the full query path
		fromMs, err := strconv.ParseInt(q.TimeRange.From, 10, 64)
		require.NoError(t, err)
		require.WithinDuration(t, now.Add(-time.Hour), time.UnixMilli(fromMs), time.Minute)
	})

	ineligible := []struct {
		name    string
		queries []string
		headers map[string]string
	}{
		{name: "two queries", queries: []string{ds1A, `{"refId": "B", "datasource": {"uid": "ds1"}}`}},
		{name: "two datasources", queries: []string{ds1A, `{"refId": "B", "datasource": {"uid": "ds2"}}`}},
		{name: "an expression", queries: []string{`{"refId": "A", "datasource": {"uid": "__expr__"}, "type": "math", "expression": "1"}`}},
		{name: "an alert query", queries: []string{ds1A}, headers: map[string]string{models.FromAlertHeaderName: "true"}},
	}
	for _, tc := range ineligible {
		t.Run("is not eligible with "+tc.name, func(t *testing.T) {
			reqDTO := dtos.MetricRequest{From: "now-1h", To: "now"}
			for _, js := range tc.queries {
				reqDTO.Queries = append(reqDTO.Queries, query(t, js))
			}

			k8sReq, ds, ok, err := PrepareSingleDatasourceRequest(ctx, log.NewNopLogger(), dscache, reqDTO, tc.headers)
			require.NoError(t, err)
			require.False(t, ok)
			require.Nil(t, k8sReq)
			require.Nil(t, ds)
		})
	}

	t.Run("returns parse errors", func(t *testing.T) {
		reqDTO := dtos.MetricRequest{From: "now-1h", To: "now", Queries: []*simplejson.Json{query(t, `{"refId": "A", "datasource": {"uid": "missing"}}`)}}

		_, _, ok, err := PrepareSingleDatasourceRequest(ctx, log.NewNopLogger(), dscache, reqDTO, nil)
		require.Error(t, err)
		require.False(t, ok)
	})
}
