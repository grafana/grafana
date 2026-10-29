package expr

import (
	"context"
	"encoding/json"
	"maps"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type recordingEndpoint struct {
	mockEndpoint
	requests []*backend.QueryDataRequest
}

func (re *recordingEndpoint) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	re.requests = append(re.requests, req)
	return re.mockEndpoint.QueryData(ctx, req)
}

func TestDatasourceRequestsAreMarkedAsFromExpression(t *testing.T) {
	dsQuery := Query{
		RefID: "A",
		DataSource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		JSON:      json.RawMessage(`{ "datasource": { "uid": "test" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		TimeRange: AbsoluteTimeRange{},
	}
	exprQuery := func(body string) Query {
		return Query{
			RefID:      "B",
			DataSource: dataSourceModel(),
			JSON:       json.RawMessage(body),
			TimeRange:  AbsoluteTimeRange{},
		}
	}

	tests := []struct {
		name    string
		queries []Query
		headers map[string]string
	}{
		{
			name:    "SQL expression",
			queries: []Query{dsQuery, exprQuery(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "sql", "expression": "SELECT * FROM A" }`)},
		},
		{
			name:    "math expression",
			queries: []Query{dsQuery, exprQuery(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "math", "expression": "$A * 2" }`)},
		},
		{
			name:    "reduce expression",
			queries: []Query{dsQuery, exprQuery(`{ "datasource": { "uid": "__expr__", "type": "__expr__"}, "type": "reduce", "reducer": "last", "expression": "A" }`)},
		},
		{
			// Alert rules send every query through the expression service, even
			// a single data source query with no expression.
			name:    "alert rule evaluation",
			queries: []Query{dsQuery},
			headers: map[string]string{"FromAlert": "true", "http_X-Rule-Uid": "rule-1"},
		},
	}

	for _, grouped := range []bool{false, true} {
		for _, tt := range tests {
			name := tt.name
			if grouped {
				name += " grouped by data source"
			}
			t.Run(name, func(t *testing.T) {
				frame := data.NewFrame("",
					data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
					data.NewField("value", nil, []*float64{new(2.0)}),
				)
				resp := map[string]backend.DataResponse{"A": {Frames: data.Frames{frame}}}
				s, req := newMockQueryService(resp, tt.queries)
				endpoint := &recordingEndpoint{mockEndpoint: mockEndpoint{Responses: resp}}
				s.dataService = endpoint
				flags := []any{featuremgmt.FlagSqlExpressions}
				if grouped {
					flags = append(flags, featuremgmt.FlagSseGroupByDatasource)
				}
				s.features = featuremgmt.WithFeatures(flags...)

				if tt.headers != nil {
					req.Headers = maps.Clone(tt.headers)
				}

				pl, err := s.BuildPipeline(t.Context(), req)
				require.NoError(t, err)
				_, err = s.ExecutePipeline(context.Background(), time.Now(), pl)
				require.NoError(t, err)

				require.Len(t, endpoint.requests, 1)
				dsReq := endpoint.requests[0]
				require.Equal(t, "true", dsReq.GetHTTPHeader(HeaderFromExpression))
				// Some plugins, such as the AWS SDK async data sources and IoT SiteWise,
				// read this raw map key instead of calling GetHTTPHeader.
				require.Equal(t, "true", dsReq.Headers["http_X-Grafana-From-Expr"])
				for k, v := range tt.headers {
					require.Equal(t, v, dsReq.Headers[k], "incoming header %q must reach the data source", k)
				}
				if tt.headers != nil {
					require.Equal(t, tt.headers, req.Headers, "the expression request's headers must not change")
				}
			})
		}
	}
}
