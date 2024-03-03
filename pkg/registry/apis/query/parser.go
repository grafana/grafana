package query

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/resource"
	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
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
	// Datasource queries, one for each datasource
	Requests []datasourceRequest `json:"requests,omitempty"`

	// Expressions in required execution order
	Expressions []expr.ExpressionQuery `json:"expressions,omitempty"`

	// Expressions include explicit hacks for influx+prometheus
	RefIDTypes map[string]string `json:"types,omitempty"`

	// Hidden queries used as dependencies
	HideBeforeReturn []string `json:"hide,omitempty"`
}

// Support old requests with name or internal ids
type LegacyLookupFunction = func(context context.Context, name string, id int64) *resource.DataSourceRef

type queryParser struct {
	lookup LegacyLookupFunction
	reader *expr.ExpressionQueryReader
	tracer tracing.Tracer
}

func newQueryParser(reader *expr.ExpressionQueryReader, lookup LegacyLookupFunction, tracer tracing.Tracer) *queryParser {
	return &queryParser{
		reader: reader,
		lookup: lookup,
		tracer: tracer,
	}
}

// Split the main query into multiple
func (p *queryParser) parseRequest(ctx context.Context, input *query.QueryDataRequest) (parsedRequestInfo, error) {
	ctx, span := p.tracer.Start(ctx, "QueryService.parseRequest")
	defer span.End()

	queryRefIDs := make(map[string]*resource.DataQuery, len(input.Queries))
	expressions := make(map[string]*expr.ExpressionQuery)
	index := make(map[string]int) // index lookup
	rsp := parsedRequestInfo{
		RefIDTypes: make(map[string]string, len(input.Queries)),
	}

	// Ensure a valid time range
	if input.From == "" {
		input.From = "now-6h"
	}
	if input.To == "" {
		input.To = ""
	}

	for _, q := range input.Queries {
		// 1. Ensure a valid datasource
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

		// Fill the time range from
		if q.TimeRange == nil {
			q.TimeRange = &resource.TimeRange{}
		}
		if q.TimeRange.From == "" {
			q.TimeRange.From = input.From
		}
		if q.TimeRange.To == "" {
			q.TimeRange.To = input.To
		}

		// Process each query
		if expr.IsDataSource(ds.UID) {
			_, ok := expressions[q.RefID]
			if ok {
				return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
			}
			_, ok = queryRefIDs[q.RefID]
			if ok {
				return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
			}

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
			exp.GraphID = int64(len(expressions) + 1)
			expressions[q.RefID] = &exp
		} else {
			// 2. Verify the RefID is unique
			_, ok := queryRefIDs[q.RefID]
			if ok {
				return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
			}
			_, ok = expressions[q.RefID]
			if ok {
				return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
			}

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

			req := rsp.Requests[idx].Request
			req.Queries = append(req.Queries, q)
			queryRefIDs[q.RefID] = &req.Queries[len(req.Queries)-1]
		}

		// Mark all the queries that should be hidden ()
		if q.Hide {
			rsp.HideBeforeReturn = append(rsp.HideBeforeReturn, q.RefID)
		}
	}

	// Make sure all referenced variables exist and the expression order is stable
	if len(expressions) > 0 {
		queryNode := &expr.ExpressionQuery{
			GraphID: -1,
		}

		// Build the graph for a request
		dg := simple.NewDirectedGraph()
		dg.AddNode(queryNode)
		for _, exp := range expressions {
			dg.AddNode(exp)
		}
		for _, exp := range expressions {
			vars := exp.Command.NeedsVars()
			for _, refId := range vars {
				target := queryNode
				q, ok := queryRefIDs[refId]
				if !ok {
					target, ok = expressions[refId]
					if !ok {
						return rsp, fmt.Errorf("expression [%s] is missing variable [%s]", exp.RefID, refId)
					}
				}
				// Do not hide queries used in variables
				if q != nil && q.Hide {
					q.Hide = false
				}
				if target.ID() == exp.ID() {
					return rsp, fmt.Errorf("expression [%s] can not depend on itself", exp.RefID)
				}
				dg.SetEdge(dg.NewEdge(target, exp))
			}
		}

		// Add the sorted expressions
		sortedNodes, err := topo.SortStabilized(dg, nil)
		if err != nil {
			return rsp, fmt.Errorf("cyclic references in query")
		}
		for _, v := range sortedNodes {
			if v.ID() > 0 {
				rsp.Expressions = append(rsp.Expressions, *v.(*expr.ExpressionQuery))
			}
		}
	}

	return rsp, nil
}
