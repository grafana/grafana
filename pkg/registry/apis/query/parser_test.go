package query

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
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
			DataQueryRequest: resource.DataQueryRequest{
				Queries: []resource.DataQuery{{
					CommonQueryProperties: resource.CommonQueryProperties{
						RefID: "A",
					},
				}},
			},
		})
		require.Error(t, err) // Missing datasource
		require.Empty(t, split.Requests)
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

func (s *legacyDataSourceRetriever) GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*resource.DataSourceRef, error) {
	if id == 100 {
		return &resource.DataSourceRef{
			Type: "plugin-aaaa",
			UID:  "AAA",
		}, nil
	}
	if name != "" {
		return &resource.DataSourceRef{
			Type: "plugin-bbb",
			UID:  name,
		}, nil
	}
	return nil, fmt.Errorf("missing parameter")
}
