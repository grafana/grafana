package query

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data/utils/jsoniter"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources/service"
)

type datasourceRequest struct {
	// The type
	PluginId string `json:"pluginId"`

	// The UID
	UID string `json:"uid"`

	// Optionally show the additional query properties
	Request *data.QueryDataRequest `json:"request"`

	// Headers that should be forwarded to the next request
	Headers map[string]string `json:"headers,omitempty"`
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

type queryParser struct {
	legacy service.LegacyDataSourceLookup
	reader *expr.ExpressionQueryReader
	tracer tracing.Tracer
}

func newQueryParser(reader *expr.ExpressionQueryReader, legacy service.LegacyDataSourceLookup, tracer tracing.Tracer) *queryParser {
	return &queryParser{
		reader: reader,
		legacy: legacy,
		tracer: tracer,
	}
}

// Split the main query into multiple
func (p *queryParser) parseRequest(ctx context.Context, input *query.QueryDataRequest) (parsedRequestInfo, error) {
	ctx, span := p.tracer.Start(ctx, "QueryService.parseRequest")
	defer span.End()

	queryRefIDs := make(map[string]*data.DataQuery, len(input.Queries))
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
		input.To = "now"
	}

	for _, q := range input.Queries {
		_, found := queryRefIDs[q.RefID]
		if found {
			return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
		}
		_, found = expressions[q.RefID]
		if found {
			return rsp, fmt.Errorf("multiple queries found for refId: %s", q.RefID)
		}

		ds, err := p.getValidDataSourceRef(ctx, q.Datasource, q.DatasourceID)
		if err != nil {
			return rsp, err
		}

		// Process each query
		if expr.IsDataSource(ds.UID) {
			// In order to process the query as a typed expression query, we
			// are writing it back to JSON and parsing again.  Alternatively we
			// could construct it from the untyped map[string]any additional properties
			// but this approach lets us focus on well typed behavior first
			raw, err := json.Marshal(q)
			if err != nil {
				return rsp, err
			}
			iter, err := jsoniter.ParseBytes(jsoniter.ConfigDefault, raw)
			if err != nil {
				return rsp, err
			}
			exp, err := p.reader.ReadQuery(q, iter)
			if err != nil {
				return rsp, err
			}
			exp.GraphID = int64(len(expressions) + 1)
			expressions[q.RefID] = &exp
		} else {
			key := fmt.Sprintf("%s/%s", ds.Type, ds.UID)
			idx, ok := index[key]
			if !ok {
				idx = len(index)
				index[key] = idx
				rsp.Requests = append(rsp.Requests, datasourceRequest{
					PluginId: ds.Type,
					UID:      ds.UID,
					Request: &data.QueryDataRequest{
						TimeRange: input.TimeRange,
						Debug:     input.Debug,
						// no queries
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

func (p *queryParser) getValidDataSourceRef(ctx context.Context, ds *data.DataSourceRef, id int64) (*data.DataSourceRef, error) {
	if ds == nil {
		if id == 0 {
			return nil, fmt.Errorf("missing datasource reference or id")
		}
		if p.legacy == nil {
			return nil, fmt.Errorf("legacy datasource lookup unsupported (id:%d)", id)
		}
		return p.legacy.GetDataSourceFromDeprecatedFields(ctx, "", id)
	}
	if ds.Type == "" {
		if ds.UID == "" {
			return nil, fmt.Errorf("missing name/uid in data source reference")
		}
		if ds.UID == expr.DatasourceType {
			return ds, nil
		}
		if p.legacy == nil {
			return nil, fmt.Errorf("legacy datasource lookup unsupported (name:%s)", ds.UID)
		}
		return p.legacy.GetDataSourceFromDeprecatedFields(ctx, ds.UID, 0)
	}
	return ds, nil
}
