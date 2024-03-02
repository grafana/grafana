package query

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
)

type datasourceRequest struct {
	// The type
	PluginId string `json:"pluginId"`

	// The UID
	UID string `json:"uid"`

	// Optionally show the additional query properties
	Request *query.QueryDataRequest `json:"request"`
}

type parsedRequestInfo struct {
	// Expressions
	Expressions []expr.ExpressionQuery `json:"expressions,omitempty"`

	// Datasource queries, one for each datasource
	Requests []datasourceRequest `json:"requests"`
}

// Support old requests with name or internal ids
type LegacyLookupFunction = func(context context.Context, name string, id int64) *resource.DataSourceRef

type queryParser struct {
	lookup LegacyLookupFunction
	reader *expr.ExpressionQueryReader
}

func newQueryParser(reader *expr.ExpressionQueryReader, lookup LegacyLookupFunction) *queryParser {
	return &queryParser{
		reader: reader,
		lookup: lookup,
	}
}

// Split the main query into multiple
func (p *queryParser) parseRequest(ctx context.Context, input *query.QueryDataRequest) (parsedRequestInfo, error) {
	refIDs := make(map[string]bool, len(input.Queries))
	index := make(map[string]int) // index lookup
	rsp := parsedRequestInfo{}
	for _, q := range input.Queries {
		// 1. Verify the RefID is unique
		_, ok := refIDs[q.RefID]
		if ok {
			return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
		}
		refIDs[q.RefID] = true

		// 2. Ensure a valid datasource
		ds := q.Datasource
		if ds == nil {
			if q.DatasourceID < 0 {
				return rsp, fmt.Errorf("missing datasource reference")
			}
			ds = p.lookup(ctx, "", q.DatasourceID)
			if ds == nil {
				return rsp, fmt.Errorf("unable to find datasource: %d", q.DatasourceID)
			}
		}
		if ds.Type == "" {
			name := ds.UID
			ds = p.lookup(ctx, name, 0)
			if ds == nil {
				return rsp, fmt.Errorf("unable to find datasource by name: %s", name)
			}
		}

		// Process each query
		if expr.IsDataSource(ds.UID) {
			raw, err := json.Marshal(q)
			if err != nil {
				return rsp, err
			}
			iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, raw)
			if err != nil {
				return rsp, err
			}
			exp, err := p.reader.ReadQuery(q.CommonQueryProperties, iter)
			if err != nil {
				return rsp, err
			}
			rsp.Expressions = append(rsp.Expressions, exp)
		} else {
			// 3. Match the query group
			key := fmt.Sprintf("%s/%s", ds.Type, ds.UID)
			idx, ok := index[key]
			if !ok {
				idx = len(index)
				index[key] = idx
				rsp.Requests = append(rsp.Requests, datasourceRequest{
					PluginId: ds.Type,
					UID:      ds.UID,
					Request: &query.QueryDataRequest{
						TypeMeta: input.TypeMeta,
						From:     input.From,
						To:       input.To,
						Debug:    input.Debug,
					},
				})
			}
			rsp.Requests[idx].Request.Queries = append(rsp.Requests[idx].Request.Queries, q)
		}
	}

	// Make sure all referenced variables exist
	for idx, exp := range rsp.Expressions {
		vars := exp.Command.NeedsVars()
		for _, refId := range vars {
			_, ok := refIDs[refId]
			if !ok {
				return rsp, fmt.Errorf("expression [%s] is missing variable [%s]", exp.RefID, refId)
			}
		}
		rsp.Expressions[idx].Variables = vars
	}
	return rsp, nil
}
