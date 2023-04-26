package conditions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/datasources"
	fd "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func TestQueryInterval(t *testing.T) {
	t.Run("When evaluating query condition, regarding the interval value", func(t *testing.T) {
		t.Run("Can handle interval-calculation with no panel-min-interval and no datasource-min-interval", func(t *testing.T) {
			// no panel-min-interval in the queryModel
			queryModel := `{"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`

			// no datasource-min-interval
			var dataSourceJson *simplejson.Json = nil

			timeRange := "5m"

			verifier := func(query legacydata.DataSubQuery) {
				// 5minutes timerange = 300000milliseconds; default-resolution is 1500pixels,
				// so we should have 300000/1500 = 200milliseconds here
				require.Equal(t, int64(200), query.IntervalMS)
				require.Equal(t, intervalv2.DefaultRes, query.MaxDataPoints)
			}

			applyScenario(t, timeRange, dataSourceJson, queryModel, verifier)
		})
		t.Run("Can handle interval-calculation with panel-min-interval and no datasource-min-interval", func(t *testing.T) {
			// panel-min-interval in the queryModel
			queryModel := `{"interval":"123s", "target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`

			// no datasource-min-interval
			var dataSourceJson *simplejson.Json = nil

			timeRange := "5m"

			verifier := func(query legacydata.DataSubQuery) {
				require.Equal(t, int64(123000), query.IntervalMS)
				require.Equal(t, intervalv2.DefaultRes, query.MaxDataPoints)
			}

			applyScenario(t, timeRange, dataSourceJson, queryModel, verifier)
		})
		t.Run("Can handle interval-calculation with no panel-min-interval and datasource-min-interval", func(t *testing.T) {
			// no panel-min-interval in the queryModel
			queryModel := `{"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`

			// min-interval in datasource-json
			dataSourceJson, err := simplejson.NewJson([]byte(`{
			"timeInterval": "71s"
		}`))
			require.Nil(t, err)

			timeRange := "5m"

			verifier := func(query legacydata.DataSubQuery) {
				require.Equal(t, int64(71000), query.IntervalMS)
				require.Equal(t, intervalv2.DefaultRes, query.MaxDataPoints)
			}

			applyScenario(t, timeRange, dataSourceJson, queryModel, verifier)
		})
		t.Run("Can handle interval-calculation with both panel-min-interval and datasource-min-interval", func(t *testing.T) {
			// panel-min-interval in the queryModel
			queryModel := `{"interval":"19s", "target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`

			// min-interval in datasource-json
			dataSourceJson, err := simplejson.NewJson([]byte(`{
			"timeInterval": "71s"
		}`))
			require.Nil(t, err)

			timeRange := "5m"

			verifier := func(query legacydata.DataSubQuery) {
				// when both panel-min-interval and datasource-min-interval exists,
				// panel-min-interval is used
				require.Equal(t, int64(19000), query.IntervalMS)
				require.Equal(t, intervalv2.DefaultRes, query.MaxDataPoints)
			}

			applyScenario(t, timeRange, dataSourceJson, queryModel, verifier)
		})

		t.Run("Can handle no min-interval, and very small time-ranges, where the default-min-interval=1ms applies", func(t *testing.T) {
			// no panel-min-interval in the queryModel
			queryModel := `{"target": "aliasByNode(statsd.fakesite.counters.session_start.mobile.count, 4)"}`

			// no datasource-min-interval
			var dataSourceJson *simplejson.Json = nil

			timeRange := "1s"

			verifier := func(query legacydata.DataSubQuery) {
				// no min-interval exists, the default-min-interval will be used,
				// and for such a short time-range this will cause the value to be 1millisecond.
				require.Equal(t, int64(1), query.IntervalMS)
				require.Equal(t, intervalv2.DefaultRes, query.MaxDataPoints)
			}

			applyScenario(t, timeRange, dataSourceJson, queryModel, verifier)
		})
	})
}

type queryIntervalTestContext struct {
	result    *alerting.EvalContext
	condition *QueryCondition
}

type queryIntervalVerifier func(query legacydata.DataSubQuery)

type fakeIntervalTestReqHandler struct {
	//nolint: staticcheck // legacydata.DataResponse deprecated
	response legacydata.DataResponse
	verifier queryIntervalVerifier
}

//nolint:staticcheck // legacydata.DataResponse deprecated
func (rh fakeIntervalTestReqHandler) HandleRequest(ctx context.Context, dsInfo *datasources.DataSource, query legacydata.DataQuery) (
	legacydata.DataResponse, error) {
	q := query.Queries[0]
	rh.verifier(q)
	return rh.response, nil
}

//nolint:staticcheck // legacydata.DataResponse deprecated
func applyScenario(t *testing.T, timeRange string, dataSourceJsonData *simplejson.Json, queryModel string, verifier func(query legacydata.DataSubQuery)) {
	t.Run("desc", func(t *testing.T) {
		db := dbtest.NewFakeDB()
		store := alerting.ProvideAlertStore(db, localcache.ProvideService(), &setting.Cfg{}, nil, featuremgmt.WithFeatures())

		ctx := &queryIntervalTestContext{}
		ctx.result = &alerting.EvalContext{
			Ctx:              context.Background(),
			Rule:             &alerting.Rule{},
			RequestValidator: &validations.OSSPluginRequestValidator{},
			Store:            store,
			DatasourceService: &fd.FakeDataSourceService{
				DataSources: []*datasources.DataSource{
					{ID: 1, Type: datasources.DS_GRAPHITE, JsonData: dataSourceJsonData},
				},
			},
		}

		jsonModel, err := simplejson.NewJson([]byte(`{
            "type": "query",
            "query":  {
              "params": ["A", "` + timeRange + `", "now"],
              "datasourceId": 1,
              "model": ` + queryModel + `
            },
            "reducer":{"type": "avg"},
					"evaluator":{"type": "gt", "params": [100]}
          }`))
		require.Nil(t, err)

		condition, err := newQueryCondition(jsonModel, 0)
		require.Nil(t, err)

		ctx.condition = condition

		qr := legacydata.DataQueryResult{}

		reqHandler := fakeIntervalTestReqHandler{
			response: legacydata.DataResponse{
				Results: map[string]legacydata.DataQueryResult{
					"A": qr,
				},
			},
			verifier: verifier,
		}
		_, err = condition.Eval(ctx.result, reqHandler)

		require.Nil(t, err)
	})
}
