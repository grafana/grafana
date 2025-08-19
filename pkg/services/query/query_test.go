package query

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/web"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationParseMetricRequest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("Test a simple single datasource query", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.False(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 1)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Len(t, parsedReq.getFlattenedQueries(), 2)
	})

	t.Run("Test a simple single datasource query with missing time range", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		mr.From = ""
		mr.To = ""
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.False(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 1)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		queries := parsedReq.getFlattenedQueries()
		assert.Len(t, queries, 2)

		for _, q := range queries {
			require.Equal(t, int64(0), q.query.TimeRange.From.UnixMilli())
			require.Equal(t, int64(0), q.query.TimeRange.To.UnixMilli())
		}
	})

	t.Run("Test a single datasource query with expressions", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"type": "math",
			"expression": "$A - 50"
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		require.True(t, parsedReq.hasExpression)
		require.Len(t, parsedReq.parsedQueries, 2)
		require.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		require.Len(t, parsedReq.getFlattenedQueries(), 2)
		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		require.NoError(t, err)

		t.Run("Should forward user and org ID to QueryData from expression request", func(t *testing.T) {
			require.NotNil(t, tc.pluginContext.req)
			require.NotNil(t, tc.pluginContext.req.PluginContext.User)
			require.Equal(t, tc.signedInUser.Login, tc.pluginContext.req.PluginContext.User.Login)
			require.Equal(t, tc.signedInUser.Name, tc.pluginContext.req.PluginContext.User.Name)
			require.Equal(t, tc.signedInUser.Email, tc.pluginContext.req.PluginContext.User.Email)
			require.Equal(t, string(tc.signedInUser.OrgRole), tc.pluginContext.req.PluginContext.User.Role)
			require.Equal(t, tc.signedInUser.OrgID, tc.pluginContext.req.PluginContext.OrgID)
		})
	})

	t.Run("Test a simple mixed datasource query", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "sEx6ZvSVk",
				"type": "testdata"
			}
		}`, `{
			"refId": "C",
			"datasource": {
				"uid": "sEx6ZvSVk",
				"type": "testdata"
			}
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.False(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 2)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Len(t, parsedReq.parsedQueries["gIEkMvIVz"], 1)
		assert.Contains(t, parsedReq.parsedQueries, "sEx6ZvSVk")
		assert.Len(t, parsedReq.parsedQueries["sEx6ZvSVk"], 2)
		assert.Len(t, parsedReq.getFlattenedQueries(), 3)
	})

	t.Run("Test a mixed datasource query with expressions", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "sEx6ZvSVk",
				"type": "testdata"
			}
		}`, `{
			"refId": "A_resample",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"expression": "A",
			"type": "resample",
			"downsampler": "mean",
			"upsampler": "fillna",
			"window": "10s"
		}`, `{
			"refId": "B_resample",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"expression": "B",
			"type": "resample",
			"downsampler": "mean",
			"upsampler": "fillna",
			"window": "10s"
		}`, `{
			"refId": "C",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"type": "math",
			"expression": "$A_resample + $B_resample"
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.True(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 3)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Contains(t, parsedReq.parsedQueries, "sEx6ZvSVk")
		assert.Len(t, parsedReq.getFlattenedQueries(), 5)
		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		assert.NoError(t, err)
	})

	t.Run("Header validation", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "sEx6ZvSVk",
				"type": "testdata"
			}
		}`)
		httpreq, err := http.NewRequest(http.MethodPost, "http://localhost/", bytes.NewReader([]byte{}))
		require.NoError(t, err)

		reqCtx := &contextmodel.ReqContext{
			Context: &web.Context{},
		}
		ctx := ctxkey.Set(context.Background(), reqCtx)

		*httpreq = *httpreq.WithContext(ctx)
		reqCtx.Req = httpreq

		httpreq.Header.Add("X-Datasource-Uid", "gIEkMvIVz")
		_, err = tc.queryService.parseMetricRequest(httpreq.Context(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)

		// With the second value it is OK
		httpreq.Header.Add("X-Datasource-Uid", "sEx6ZvSVk")
		_, err = tc.queryService.parseMetricRequest(httpreq.Context(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)

		// Single header with comma syntax
		httpreq, _ = http.NewRequest(http.MethodPost, "http://localhost/", bytes.NewReader([]byte{}))
		httpreq.Header.Set("X-Datasource-Uid", "gIEkMvIVz, sEx6ZvSVk")
		_, err = tc.queryService.parseMetricRequest(httpreq.Context(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
	})

	t.Run("Test a duplicated refId", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.Error(t, err)
	})

	t.Run("Test a datasource query with global time range", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		mr.From = "1753944628000"
		mr.To = "1753944629000"
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.Len(t, parsedReq.parsedQueries, 1)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		queries := parsedReq.getFlattenedQueries()
		assert.Len(t, queries, 2)
		for _, q := range queries {
			assert.Equal(t, int64(1753944628000), q.query.TimeRange.From.UnixMilli())
			assert.Equal(t, int64(1753944629000), q.query.TimeRange.To.UnixMilli())
		}
	})
	t.Run("Test a datasource query with local time range", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"from": "1753944618000",
				"to": "1753944619000"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"from": "1753944628000",
				"to": "1753944629000"
			}
		}`)
		mr.From = ""
		mr.To = ""

		verifyTimestamps := func(parsedReq *parsedRequest, ts1 int64, ts2 int64, ts3 int64, ts4 int64) {
			require.NotNil(t, parsedReq)
			assert.Len(t, parsedReq.parsedQueries, 1)
			assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
			queries := parsedReq.getFlattenedQueries()
			assert.Len(t, queries, 2)

			assert.Equal(t, ts1, queries[0].query.TimeRange.From.UnixMilli())
			assert.Equal(t, ts2, queries[0].query.TimeRange.To.UnixMilli())

			assert.Equal(t, ts3, queries[1].query.TimeRange.From.UnixMilli())
			assert.Equal(t, ts4, queries[1].query.TimeRange.To.UnixMilli())
		}

		// with flag enabled
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, true)
		require.NoError(t, err)

		verifyTimestamps(parsedReq,
			int64(1753944618000),
			int64(1753944619000),
			int64(1753944628000),
			int64(1753944629000))

		// with flag disabled
		parsedReq2, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, false)
		require.NoError(t, err)

		verifyTimestamps(parsedReq2, int64(0), int64(0), int64(0), int64(0))
	})

	t.Run("Test a datasource query with local time range, malformed to-value", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"from": "1753944618000",
				"to": 1753944619000
			}
		}`)
		mr.From = ""
		mr.To = ""
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, true)
		require.Error(t, err)
		require.ErrorContains(t, err, "'to'")
	})
	t.Run("Test a datasource query with local time range, missing to-value", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"from": "1753944618000"
			}
		}`)
		mr.From = ""
		mr.To = ""
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, true)
		require.Error(t, err)
		require.ErrorContains(t, err, "'to'")
	})
	t.Run("Test a datasource query with local time range, malformed from-value", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"from": 1753944618000,
				"to": "1753944619000"
			}
		}`)
		mr.From = ""
		mr.To = ""
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, true)
		require.Error(t, err)
		require.ErrorContains(t, err, "'from'")
	})
	t.Run("Test a datasource query with local time range, missing from-value", func(t *testing.T) {
		tc := setup(t, false, nil)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			},
			"timeRange": {
				"to": "1753944619000"
			}
		}`)
		mr.From = ""
		mr.To = ""
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr, true)
		require.Error(t, err)
		require.ErrorContains(t, err, "'from'")
	})
}

func TestIntegrationQueryDataMultipleSources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("can query multiple datasources", func(t *testing.T) {
		tc := setup(t, false, nil)
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"refId": "A"
			}
		`))
		require.NoError(t, err)
		query2, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds2"
				},
				"refId": "B"
			}
		`))
		require.NoError(t, err)
		queries := []*simplejson.Json{query1, query2}
		reqDTO := dtos.MetricRequest{
			From:    "2022-01-01",
			To:      "2022-01-02",
			Queries: queries,
			Debug:   false,
		}

		req, err := http.NewRequest("POST", "http://localhost:3000", nil)
		require.NoError(t, err)
		reqCtx := &contextmodel.ReqContext{
			SkipQueryCache: false,
			Context: &web.Context{
				Resp: web.NewResponseWriter(http.MethodGet, httptest.NewRecorder()),
				Req:  req,
			},
		}
		ctx := ctxkey.Set(context.Background(), reqCtx)

		_, err = tc.queryService.QueryData(ctx, tc.signedInUser, true, reqDTO)
		require.NoError(t, err)

		// response headers should be merged
		header := contexthandler.FromContext(ctx).Resp.Header()
		assert.Len(t, header.Values("test"), 2)
	})

	t.Run("can query multiple datasources with an expression present", func(t *testing.T) {
		tc := setup(t, false, nil)
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"refId": "A"
			}
		`))
		require.NoError(t, err)
		query2, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds2"
				},
				"refId": "B"
			}
		`))
		require.NoError(t, err)
		query3, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"name": "Expression",
					"type": "__expr__",
					"uid": "__expr__"
				},
				"expression": "$A + 1",
				"hide": false,
				"refId": "EXPRESSION",
				"type": "math"
			}
		`))
		require.NoError(t, err)
		queries := []*simplejson.Json{query1, query2, query3}
		reqDTO := dtos.MetricRequest{
			From:    "2022-01-01",
			To:      "2022-01-02",
			Queries: queries,
			Debug:   false,
		}

		// without query parameter
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)
		require.NoError(t, err)

		httpreq, err := http.NewRequest(http.MethodPost, "http://localhost/ds/query?expression=true", bytes.NewReader([]byte{}))
		require.NoError(t, err)

		reqCtx := &contextmodel.ReqContext{
			Context: &web.Context{},
		}
		ctx := ctxkey.Set(context.Background(), reqCtx)

		*httpreq = *httpreq.WithContext(ctx)
		reqCtx.Req = httpreq

		httpreq.Header.Add("X-Datasource-Uid", "gIEkMvIVz")

		// with query parameter
		_, err = tc.queryService.QueryData(httpreq.Context(), tc.signedInUser, true, reqDTO)
		require.NoError(t, err)
	})

	t.Run("error is returned in query when one of the queries fails", func(t *testing.T) {
		tc := setup(t, false, nil)

		query1, _ := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"refId": "A"
			}
		`))
		query2, _ := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "prometheus",
					"uid": "ds2"
				},
				"refId": "B",
				"queryType": "FAIL"
			}
		`))

		queries := []*simplejson.Json{query1, query2}

		reqDTO := dtos.MetricRequest{
			From:    "2022-01-01",
			To:      "2022-01-02",
			Queries: queries,
			Debug:   false,
		}

		res, err := tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)

		require.NoError(t, err)
		require.Error(t, res.Responses["B"].Error)
		// Responses aren't mocked, so a "healthy" query will just return an empty response
		require.NotContains(t, res.Responses, "A")
	})

	t.Run("ignores a deprecated datasourceID", func(t *testing.T) {
		tc := setup(t, false, nil)
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"datasourceId": 1,
				"refId": "A"
			}
		`))
		require.NoError(t, err)
		queries := []*simplejson.Json{query1}
		reqDTO := dtos.MetricRequest{
			From:    "2022-01-01",
			To:      "2022-01-02",
			Queries: queries,
			Debug:   false,
		}

		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)

		require.NoError(t, err)
	})
}

func TestIntegrationQueryDataWithQSDSClient(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	t.Run("can run a simple datasource query with a mt ds client", func(t *testing.T) {
		stubbedResponse := &backend.QueryDataResponse{Responses: make(backend.Responses)}
		testClient := &testClient{
			queryDataStubbedResponse: stubbedResponse,
		}
		tc := setup(t, true, testClient)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		mr.From = "1754309340000"
		mr.To = "1754309370000"
		ctx := context.Background()
		_, err := tc.queryService.QueryData(ctx, tc.signedInUser, true, mr)
		require.NoError(t, err)

		assert.Equal(t, data.QueryDataRequest{
			Queries: []data.DataQuery{
				{
					CommonQueryProperties: data.CommonQueryProperties{
						RefID: "A",
						Datasource: &data.DataSourceRef{
							Type: "postgres",
							UID:  "gIEkMvIVz",
						},
						TimeRange: &data.TimeRange{
							From: "1754309340000",
							To:   "1754309370000",
						},
						MaxDataPoints: 100,
						IntervalMS:    1000,
					},
				},
				{
					CommonQueryProperties: data.CommonQueryProperties{
						RefID: "B",
						Datasource: &data.DataSourceRef{
							Type: "postgres",
							UID:  "gIEkMvIVz",
						},
						TimeRange: &data.TimeRange{
							From: "1754309340000",
							To:   "1754309370000",
						},
						MaxDataPoints: 100,
						IntervalMS:    1000,
					},
				},
			},
			Debug: false,
		}, testClient.queryDataLastCalledWith)
	})
}

func setup(t *testing.T, isMultiTenant bool, mockClient clientapi.QueryDataClient) *testContext {
	dss := []*datasources.DataSource{
		{UID: "gIEkMvIVz", Type: "postgres"},
		{UID: "sEx6ZvSVk", Type: "testdata"},
		{UID: "ds1", Type: "mysql"},
		{UID: "ds2", Type: "mysql"},
	}

	t.Helper()
	pc := &fakePluginClient{}
	dc := &fakeDataSourceCache{cache: dss}
	rv := &fakeDataSourceRequestValidator{}

	sqlStore, cfg := db.InitTestDBWithCfg(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	ss := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

	fakeDatasourceService := &fakeDatasources.FakeDataSourceService{
		DataSources:           dss,
		SimulatePluginFailure: false,
	}

	pCtxProvider := plugincontext.ProvideService(
		cfg,
		localcache.ProvideService(),
		&pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "postgres"}},
				{JSONData: plugins.JSONData{ID: "testdata"}},
				{JSONData: plugins.JSONData{ID: "mysql"}},
			},
		},
		&fakeDatasources.FakeCacheService{},
		fakeDatasourceService,
		pluginSettings.ProvideService(sqlStore, secretsService),
		pluginconfig.NewFakePluginRequestConfigProvider(),
	)

	var qsdsClientBuilder dsquerierclient.QSDatasourceClientBuilder
	if isMultiTenant {
		qsdsClientBuilder = dsquerierclient.NewTestQSDSClientBuilder(isMultiTenant, mockClient)
	} else {
		qsdsClientBuilder = dsquerierclient.NewTestQSDSClientBuilder(false, nil)
	}

	exprService := expr.ProvideService(
		&setting.Cfg{ExpressionsEnabled: true},
		pc,
		pCtxProvider,
		featuremgmt.WithFeatures(),
		nil,
		tracing.InitializeTracerForTest(),
		qsdsClientBuilder,
	)

	queryService := ProvideService(
		setting.NewCfg(),
		dc,
		exprService,
		rv,
		pc,
		pCtxProvider,
		qsdsClientBuilder,
	)

	return &testContext{
		pluginContext:          pc,
		secretStore:            ss,
		pluginRequestValidator: rv,
		queryService:           queryService,
		signedInUser:           &user.SignedInUser{OrgID: 1, Login: "login", Name: "name", Email: "email", OrgRole: identity.RoleAdmin},
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretStore            secretskvs.SecretsKVStore
	pluginRequestValidator *fakeDataSourceRequestValidator
	queryService           *ServiceImpl // implementation belonging to this package
	signedInUser           *user.SignedInUser
}

func metricRequestWithQueries(t *testing.T, rawQueries ...string) dtos.MetricRequest {
	t.Helper()
	queries := make([]*simplejson.Json, 0)
	for _, q := range rawQueries {
		json, err := simplejson.NewJson([]byte(q))
		require.NoError(t, err)
		queries = append(queries, json)
	}
	return dtos.MetricRequest{
		From:    "now-1h",
		To:      "now",
		Queries: queries,
		Debug:   false,
	}
}

type fakeDataSourceRequestValidator struct {
	err error
}

func (rv *fakeDataSourceRequestValidator) Validate(ds *datasources.DataSource, req *http.Request) error {
	return rv.err
}

type fakeDataSourceCache struct {
	cache []*datasources.DataSource
}

func (c *fakeDataSourceCache) GetDatasource(ctx context.Context, datasourceID int64, user identity.Requester, skipCache bool) (*datasources.DataSource, error) {
	// deprecated: fake an error to ensure we are using GetDatasourceByUID
	return nil, fmt.Errorf("not found")
}

func (c *fakeDataSourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user identity.Requester, skipCache bool) (*datasources.DataSource, error) {
	for _, ds := range c.cache {
		if ds.UID == datasourceUID {
			return ds, nil
		}
	}

	return nil, fmt.Errorf("not found")
}

type fakePluginClient struct {
	plugins.Client
	req *backend.QueryDataRequest
	mu  sync.Mutex
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.req = req

	// If an expression query ends up getting directly queried, we want it to return an error in our test.
	if req.PluginContext.PluginID == expr.DatasourceUID {
		return nil, errors.New("cant query an expression datasource")
	}

	if req.Queries[0].QueryType == "FAIL" {
		return nil, errors.New("plugin client failed")
	}

	if reqCtx := contexthandler.FromContext(ctx); reqCtx != nil && reqCtx.Resp != nil {
		reqCtx.Resp.Header().Add("test", fmt.Sprintf("header-%d", time.Now().Nanosecond()))
	}

	return &backend.QueryDataResponse{Responses: make(backend.Responses)}, nil
}

type testClient struct {
	queryDataLastCalledWith  data.QueryDataRequest
	queryDataStubbedResponse *backend.QueryDataResponse
	queryDataStubbedError    error
}

func (c *testClient) QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.queryDataLastCalledWith = req
	if c.queryDataStubbedError != nil {
		return nil, c.queryDataStubbedError
	}
	if c.queryDataStubbedResponse != nil {
		return c.queryDataStubbedResponse, nil
	}
	return nil, errors.New("no response stubbed")
}
