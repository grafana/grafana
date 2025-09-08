package expr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/maps"
	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/expr/sql"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// NodeType is the type of a DPNode. Currently either a expression command or datasource query.
type NodeType int

const (
	// TypeCMDNode is a NodeType for expression commands.
	TypeCMDNode NodeType = iota
	// TypeDatasourceNode is a NodeType for datasource queries.
	TypeDatasourceNode
	// TypeMLNode is a NodeType for Machine Learning queries.
	TypeMLNode
)

func (nt NodeType) String() string {
	switch nt {
	case TypeCMDNode:
		return "Expression"
	case TypeDatasourceNode:
		return "Datasource"
	case TypeMLNode:
		return "Machine Learning"
	default:
		return "Unknown"
	}
}

// Node is a node in a Data Pipeline. Node is either a expression command or a datasource query.
type Node interface {
	ID() int64 // ID() allows the gonum graph node interface to be fulfilled
	NodeType() NodeType
	RefID() string
	String() string
	NeedsVars() []string
	SetInputTo(refID string)
	IsInputTo() map[string]struct{}
}

type ExecutableNode interface {
	Node
	Execute(ctx context.Context, now time.Time, vars mathexp.Vars, s *Service) (mathexp.Results, error)
}

// DataPipeline is an ordered set of nodes returned from DPGraph processing.
type DataPipeline []Node

// execute runs all the command/datasource requests in the pipeline return a
// map of the refId of the of each command
func (dp *DataPipeline) execute(c context.Context, now time.Time, s *Service) (mathexp.Vars, error) {
	vars := make(mathexp.Vars)

	groupByDSFlag := s.features.IsEnabled(c, featuremgmt.FlagSseGroupByDatasource)
	// Execute datasource nodes first, and grouped by datasource.
	if groupByDSFlag {
		dsNodes := []*DSNode{}
		for _, node := range *dp {
			if node.NodeType() != TypeDatasourceNode {
				continue
			}
			dsNodes = append(dsNodes, node.(*DSNode))
		}

		executeDSNodesGrouped(c, now, vars, s, dsNodes)
	}

	for _, node := range *dp {
		if groupByDSFlag && node.NodeType() == TypeDatasourceNode {
			continue // already executed via executeDSNodesGrouped
		}

		// Don't execute nodes that have dependent nodes that have failed
		var hasDepError bool
		for _, neededVar := range node.NeedsVars() {
			if res, ok := vars[neededVar]; ok {
				if res.Error != nil {
					var depErr error
					// IF SQL expression dependency error
					if node.NodeType() == TypeCMDNode && node.(*CMDNode).CMDType == TypeSQL {
						e := sql.MakeSQLDependencyError(node.RefID(), neededVar)

						// although the SQL expression won't be executed,
						// we track a dependency error on the metric.
						eType := e.Category()
						var errWithType *sql.ErrorWithCategory
						if errors.As(res.Error, &errWithType) {
							// If it is already SQL error with type (e.g. limit exceeded, input conversion, capture the type as that)
							eType = errWithType.Category()
						}
						s.metrics.SqlCommandCount.WithLabelValues("error", eType)
						depErr = e
					} else { // general SSE dependency error
						depErr = MakeDependencyError(node.RefID(), neededVar)
					}
					errResult := mathexp.Results{
						Error: depErr,
					}
					vars[node.RefID()] = errResult
					hasDepError = true
					break
				}
			}
		}
		if hasDepError {
			continue
		}

		c, span := s.tracer.Start(c, "SSE.ExecuteNode")
		span.SetAttributes(attribute.String("node.refId", node.RefID()))
		if len(node.NeedsVars()) > 0 {
			inputRefIDs := node.NeedsVars()
			span.SetAttributes(attribute.StringSlice("node.inputRefIDs", inputRefIDs))
		}
		defer span.End()

		execNode, ok := node.(ExecutableNode)
		if !ok {
			return vars, makeUnexpectedNodeTypeError(node.RefID(), node.NodeType().String())
		}

		res, err := execNode.Execute(c, now, vars, s)
		if err != nil {
			res.Error = err
		}

		vars[node.RefID()] = res
	}
	return vars, nil
}

// GetDatasourceTypes returns an unique list of data source types used in the query. Machine learning node is encoded as `ml_<type>`, e.g. ml_outlier
func (dp *DataPipeline) GetDatasourceTypes() []string {
	if dp == nil {
		return nil
	}
	m := make(map[string]struct{}, 2)
	for _, node := range *dp {
		name := ""
		switch t := node.(type) {
		case *DSNode:
			if t.datasource != nil {
				name = t.datasource.Type
			}
		case *MLNode:
			name = fmt.Sprintf("ml_%s", t.command.Type())
		}
		if name == "" {
			continue
		}
		m[name] = struct{}{}
	}
	result := maps.Keys(m)
	slices.Sort(result)
	return result
}

// GetCommandTypes returns a sorted unique list of all server-side expression commands used in the pipeline.
func (dp *DataPipeline) GetCommandTypes() []string {
	if dp == nil {
		return nil
	}
	m := make(map[string]struct{}, 5) // 5 is big enough to cover most of the cases
	for _, node := range *dp {
		name := ""
		switch t := node.(type) {
		case *CMDNode:
			if t.Command != nil {
				name = t.Command.Type()
			}
		}
		if name == "" {
			continue
		}
		m[name] = struct{}{}
	}
	result := maps.Keys(m)
	slices.Sort(result)
	return result
}

// BuildPipeline builds a graph of the nodes, and returns the nodes in an
// executable order.
func (s *Service) buildPipeline(ctx context.Context, req *Request) (DataPipeline, error) {
	if req != nil && len(req.Headers) == 0 {
		req.Headers = map[string]string{}
	}

	instrumentSQLError := func(err error, span trace.Span) {
		var sqlErr *sql.ErrorWithCategory
		if errors.As(err, &sqlErr) {
			// The SQL expression (and the entire pipeline) will not be executed, so we
			// track the attempt to execute here.
			s.metrics.SqlCommandCount.WithLabelValues("error", sqlErr.Category()).Inc()
		}
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
	}

	_, span := s.tracer.Start(ctx, "SSE.BuildPipeline")
	var err error
	defer func() {
		instrumentSQLError(err, span)
		span.End()
	}()

	graph, err := s.buildDependencyGraph(ctx, req)
	if err != nil {
		return nil, err
	}

	nodes, err := buildExecutionOrder(graph)
	if err != nil {
		return nil, err
	}

	return nodes, nil
}

// buildDependencyGraph returns a dependency graph for a set of queries.
func (s *Service) buildDependencyGraph(ctx context.Context, req *Request) (*simple.DirectedGraph, error) {
	graph, err := s.buildGraph(ctx, req)
	if err != nil {
		return nil, err
	}

	registry := buildNodeRegistry(graph)

	if err := s.buildGraphEdges(graph, registry); err != nil {
		return nil, err
	}

	return graph, nil
}

// buildExecutionOrder returns a sequence of nodes ordered by dependency.
// Note: During execution, Datasource query nodes for the same datasource will
// be grouped into one request and executed first as phase after this call
// If the groupByDSFlag is enabled.
func buildExecutionOrder(graph *simple.DirectedGraph) ([]Node, error) {
	sortedNodes, err := topo.SortStabilized(graph, nil)
	if err != nil {
		return nil, err
	}

	var dsNodes []Node
	var otherNodes []Node

	for _, v := range sortedNodes {
		n := v.(Node)
		switch n.NodeType() {
		case TypeDatasourceNode, TypeMLNode:
			dsNodes = append(dsNodes, n)
		default:
			otherNodes = append(otherNodes, n)
		}
	}

	// Datasource/ML nodes come first, followed by all others, in original topo order
	return append(dsNodes, otherNodes...), nil
}

// buildNodeRegistry returns a lookup table for reference IDs to respective node.
func buildNodeRegistry(g *simple.DirectedGraph) map[string]Node {
	res := make(map[string]Node)

	nodeIt := g.Nodes()

	for nodeIt.Next() {
		if dpNode, ok := nodeIt.Node().(Node); ok {
			res[dpNode.RefID()] = dpNode
		}
	}

	return res
}

// buildGraph creates a new graph populated with nodes for every query.
func (s *Service) buildGraph(ctx context.Context, req *Request) (*simple.DirectedGraph, error) {
	dp := simple.NewDirectedGraph()

	for i, query := range req.Queries {
		if query.DataSource == nil || query.DataSource.UID == "" {
			return nil, fmt.Errorf("missing datasource uid in query with refId %v", query.RefID)
		}

		rawQueryProp := make(map[string]any)
		queryBytes, err := query.JSON.MarshalJSON()

		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(queryBytes, &rawQueryProp)
		if err != nil {
			return nil, err
		}

		rn := &rawNode{
			Query:      rawQueryProp,
			QueryRaw:   query.JSON,
			RefID:      query.RefID,
			TimeRange:  query.TimeRange,
			QueryType:  query.QueryType,
			DataSource: query.DataSource,
			idx:        int64(i),
		}

		var node Node
		switch NodeTypeFromDatasourceUID(query.DataSource.UID) {
		case TypeDatasourceNode:
			node, err = s.buildDSNode(dp, rn, req)
		case TypeCMDNode:
			node, err = buildCMDNode(ctx, rn, s.features, s.cfg)
		case TypeMLNode:
			if s.features.IsEnabledGlobally(featuremgmt.FlagMlExpressions) {
				node, err = s.buildMLNode(dp, rn, req)
				if err != nil {
					err = fmt.Errorf("fail to parse expression with refID %v: %w", rn.RefID, err)
				}
			}
		}

		if node == nil && err == nil {
			err = fmt.Errorf("unsupported node type '%s'", NodeTypeFromDatasourceUID(query.DataSource.UID))
		}

		if err != nil {
			return nil, err
		}

		dp.AddNode(node)
	}
	return dp, nil
}

// buildGraphEdges generates graph edges based on each node's dependencies.
func (s *Service) buildGraphEdges(dp *simple.DirectedGraph, registry map[string]Node) error {
	nodeIt := dp.Nodes()

	for nodeIt.Next() {
		node := nodeIt.Node().(Node)

		if node.NodeType() != TypeCMDNode {
			// datasource node, nothing to do for now. Although if we want expression results to be
			// used as datasource query params some day this will need change
			continue
		}

		cmdNode := node.(*CMDNode)

		for _, neededVar := range cmdNode.Command.NeedsVars() {
			neededNode, ok := registry[neededVar]
			if !ok {
				if cmdNode.CMDType == TypeSQL {
					// With the current flow, the SQL expression won't be executed with
					// this missing dependency. But we collection the metric as there was an
					// attempt to execute a SQL expression.
					e := sql.MakeTableNotFoundError(cmdNode.refID, neededVar)
					return e
				}
				return fmt.Errorf("unable to find dependent node '%v'", neededVar)
			}

			// If the input is SQL, conversion is handled differently
			if _, ok := cmdNode.Command.(*SQLCommand); ok {
				if dsNode, ok := neededNode.(*DSNode); ok {
					dsNode.isInputToSQLExpr = true
				} else {
					// Only allow data source nodes as SQL expression inputs for now
					return fmt.Errorf("only data source queries may be inputs to a sql expression, %v is the input for %v", neededVar, cmdNode.RefID())
				}
			}

			if neededNode.ID() == cmdNode.ID() {
				return fmt.Errorf("expression '%v' cannot reference itself. Must be query or another expression", neededVar)
			}

			if cmdNode.CMDType == TypeClassicConditions {
				if neededNode.NodeType() != TypeDatasourceNode {
					return fmt.Errorf("only data source queries may be inputs to a classic condition, %v is a %v", neededVar, neededNode.NodeType())
				}
			}

			if neededNode.NodeType() == TypeCMDNode {
				if neededNode.(*CMDNode).CMDType == TypeClassicConditions {
					return fmt.Errorf("classic conditions may not be the input for other expressions, but %v is the input for %v", neededVar, cmdNode.RefID())
				}
			}

			if neededNode.NodeType() == TypeCMDNode {
				if neededNode.(*CMDNode).CMDType == TypeSQL {
					// Do not allow SQL expressions to be inputs for other expressions for now
					return fmt.Errorf("sql expressions can not be the input for other expressions, but %v in the input for %v", neededVar, cmdNode.RefID())
				}
			}

			edge := dp.NewEdge(neededNode, cmdNode)
			neededNode.SetInputTo(cmdNode.RefID())

			dp.SetEdge(edge)
		}
	}
	return nil
}

// GetCommandsFromPipeline traverses the pipeline and extracts all CMDNode commands that match the type
func GetCommandsFromPipeline[T Command](pipeline DataPipeline) []T {
	var results []T
	for _, p := range pipeline {
		if p.NodeType() != TypeCMDNode {
			continue
		}
		switch cmd := p.(type) {
		case *CMDNode:
			switch r := cmd.Command.(type) {
			case T:
				results = append(results, r)
			}
		default:
			continue
		}
	}
	return results
}
