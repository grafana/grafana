package query

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
	"testing"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type parserTestObject struct {
	Description string                 `json:"description,omitempty"`
	Request     query.QueryDataRequest `json:"input"`
	Expect      parsedRequestInfo      `json:"expect"`
	Error       string                 `json:"error,omitempty"`
}

func TestQuerySplitting(t *testing.T) {
	ctx := context.Background()
	parser := newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
		&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest())

	t.Run("missing datasource flavors", func(t *testing.T) {
		split, err := parser.parseRequest(ctx, &query.QueryDataRequest{
			QueryDataRequest: data.QueryDataRequest{
				Queries: []data.DataQuery{{
					CommonQueryProperties: data.CommonQueryProperties{
						RefID: "A",
					},
				}},
			},
		})
		require.Error(t, err) // Missing datasource
		require.Empty(t, split.Requests)
	})

	t.Run("applies default time range", func(t *testing.T) {
		split, err := parser.parseRequest(ctx, &query.QueryDataRequest{
			QueryDataRequest: data.QueryDataRequest{
				TimeRange: data.TimeRange{}, // missing
				Queries: []data.DataQuery{{
					CommonQueryProperties: data.CommonQueryProperties{
						RefID: "A",
						Datasource: &data.DataSourceRef{
							Type: "x",
							UID:  "abc",
						},
					},
				}},
			},
		})
		require.NoError(t, err)
		require.Len(t, split.Requests, 1)
		require.Equal(t, "now-6h", split.Requests[0].Request.From)
		require.Equal(t, "now", split.Requests[0].Request.To)
	})

	t.Run("verify tests", func(t *testing.T) {
		files, err := os.ReadDir("testdata")
		require.NoError(t, err)

		for _, file := range files {
			if !strings.HasSuffix(file.Name(), ".json") {
				continue
			}

			fpath := path.Join("testdata", file.Name())
			// nolint:gosec
			body, err := os.ReadFile(fpath)
			require.NoError(t, err)
			harness := &parserTestObject{}
			err = json.Unmarshal(body, harness)
			require.NoError(t, err)

			changed := false
			parsed, err := parser.parseRequest(ctx, &harness.Request)
			if err != nil {
				if !assert.Equal(t, harness.Error, err.Error(), "File %s", file) {
					changed = true
				}
			} else {
				x, _ := json.Marshal(parsed)
				y, _ := json.Marshal(harness.Expect)
				if !assert.JSONEq(t, string(y), string(x), "File %s", file) {
					changed = true
				}
			}

			if changed {
				harness.Error = ""
				harness.Expect = parsed
				if err != nil {
					harness.Error = err.Error()
				}
				jj, err := json.MarshalIndent(harness, "", "  ")
				require.NoError(t, err)
				err = os.WriteFile(fpath, jj, 0600)
				require.NoError(t, err)
			}
		}
	})
}

type legacyDataSourceRetriever struct{}

func (s *legacyDataSourceRetriever) GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*data.DataSourceRef, error) {
	if id == 100 {
		return &data.DataSourceRef{
			Type: "plugin-aaaa",
			UID:  "AAA",
		}, nil
	}
	if name != "" {
		return &data.DataSourceRef{
			Type: "plugin-bbb",
			UID:  name,
		}, nil
	}
	return nil, fmt.Errorf("missing parameter")
}
