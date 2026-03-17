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
	//nolint:staticcheck // not yet migrated to OpenFeature
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
						s.metrics.SqlCommandCount.WithLabelValues("error", eType).Inc()
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
// It fails fast on the first error (used by the execution path).
func (s *Service) buildDependencyGraph(ctx context.Context, req *Request) (*simple.DirectedGraph, error) {
	result := s.buildDependencyGraphAll(ctx, req)

	// Fail fast: return the first node build error
	for _, nr := range result.NodeResults {
		if nr.Err != nil {
			return nil, nr.Err
		}
	}

	// Fail fast: return the first edge error, with SQL-specific wrapping
	if len(result.EdgeErrors) > 0 {
		ee := result.EdgeErrors[0]
		if ee.IsMissingDep {
			if node, ok := result.Registry[ee.RefID]; ok && node.NodeType() == TypeCMDNode {
				if node.(*CMDNode).CMDType == TypeSQL {
					return nil, sql.MakeTableNotFoundError(ee.RefID, ee.NeededVar)
				}
			}
		}
		return nil, ee.Err
	}

	return result.Graph, nil
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

// nodeResult holds the result of building a single pipeline node.
type nodeResult struct {
	Node    Node        // nil if building failed
	CmdType CommandType // set for CMDNode (zero value TypeUnknown for other node types)
	Err     error       // non-nil if building failed
}

// edgeError holds a per-node edge validation error.
type edgeError struct {
	RefID        string
	NeededVar    string // the dependency refID that caused the error
	IsMissingDep bool   // true when the dependency node doesn't exist
	Err          error
}

// graphBuildResult contains the complete results of building a dependency graph,
// including per-node and per-edge errors. This is the single code path used by
// both the execution path (fail-fast via buildDependencyGraph) and the validation
// path (collect-all via ValidatePipeline).
type graphBuildResult struct {
	Graph       *simple.DirectedGraph
	NodeResults []nodeResult    // one per query, in input order
	EdgeErrors  []edgeError     // edge validation errors
	Registry    map[string]Node // refID -> Node for successfully built nodes
}

// buildDependencyGraphAll builds the full dependency graph, always continuing
// past errors to collect all per-node and per-edge results.
func (s *Service) buildDependencyGraphAll(ctx context.Context, req *Request) *graphBuildResult {
	graph := simple.NewDirectedGraph()
	nodeResults := make([]nodeResult, 0, len(req.Queries))

	// Phase 1: Build all nodes
	for i, query := range req.Queries {
		if query.DataSource == nil || query.DataSource.UID == "" {
			nodeResults = append(nodeResults, nodeResult{
				Err: fmt.Errorf("missing datasource uid in query with refId %v", query.RefID),
			})
			continue
		}

		rn, err := makeRawNode(query, int64(i))
		if err != nil {
			nodeResults = append(nodeResults, nodeResult{Err: err})
			continue
		}

		nr := buildNode(ctx, s, graph, rn, req)
		if nr.Err == nil && nr.Node != nil {
			graph.AddNode(nr.Node)
		}
		nodeResults = append(nodeResults, nr)
	}

	// Phase 2: Build edges
	registry := buildNodeRegistry(graph)
	edgeErrors := buildAllEdges(graph, registry)

	return &graphBuildResult{
		Graph:       graph,
		NodeResults: nodeResults,
		EdgeErrors:  edgeErrors,
		Registry:    registry,
	}
}

// makeRawNode creates a rawNode from a Query, handling JSON marshal/unmarshal.
func makeRawNode(query Query, idx int64) (*rawNode, error) {
	rawQueryProp := make(map[string]any)
	queryBytes, err := query.JSON.MarshalJSON()
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(queryBytes, &rawQueryProp)
	if err != nil {
		return nil, err
	}
	return &rawNode{
		Query:      rawQueryProp,
		QueryRaw:   query.JSON,
		RefID:      query.RefID,
		TimeRange:  query.TimeRange,
		QueryType:  query.QueryType,
		DataSource: query.DataSource,
		idx:        idx,
	}, nil
}

// buildNode builds a single pipeline node from a raw query definition.
// It uses concrete typed returns internally to avoid the Go nil interface gotcha
// where a nil *CMDNode assigned to a Node interface appears non-nil.
func buildNode(ctx context.Context, s *Service, dp *simple.DirectedGraph, rn *rawNode, req *Request) nodeResult {
	var node Node
	var cmdType CommandType
	var err error

	switch NodeTypeFromDatasourceUID(rn.DataSource.UID) {
	case TypeDatasourceNode:
		var dsNode *DSNode
		dsNode, err = s.buildDSNode(dp, rn, req)
		if dsNode != nil {
			node = dsNode
		}
	case TypeCMDNode:
		var cmdNode *CMDNode
		cmdNode, err = buildCMDNode(ctx, rn, s.features, s.cfg)
		if cmdNode != nil {
			node = cmdNode
			cmdType = cmdNode.CMDType
		}
	case TypeMLNode:
		//nolint:staticcheck // not yet migrated to OpenFeature
		if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagMlExpressions) {
			node, err = s.buildMLNode(dp, rn, req)
			if err != nil {
				err = fmt.Errorf("fail to parse expression with refID %v: %w", rn.RefID, err)
			}
		}
	}

	if node == nil && err == nil {
		err = fmt.Errorf("unsupported node type '%s'", NodeTypeFromDatasourceUID(rn.DataSource.UID))
	}

	return nodeResult{Node: node, CmdType: cmdType, Err: err}
}

// validateEdgeConstraints checks if an edge from neededNode to cmdNode satisfies
// all expression graph constraints. Returns an error if a constraint is violated.
func validateEdgeConstraints(cmdNode *CMDNode, neededNode Node, neededVar string) error {
	// SQL expressions can only take datasource query inputs
	if _, ok := cmdNode.Command.(*SQLCommand); ok {
		if _, ok := neededNode.(*DSNode); !ok {
			return fmt.Errorf("only data source queries may be inputs to a sql expression, %v is the input for %v", neededVar, cmdNode.RefID())
		}
	}

	// Self-reference check
	if neededNode.ID() == cmdNode.ID() {
		return fmt.Errorf("expression '%v' cannot reference itself. Must be query or another expression", neededVar)
	}

	// Classic conditions can only take datasource inputs
	if cmdNode.CMDType == TypeClassicConditions {
		if neededNode.NodeType() != TypeDatasourceNode {
			return fmt.Errorf("only data source queries may be inputs to a classic condition, %v is a %v", neededVar, neededNode.NodeType())
		}
	}

	// Classic conditions and SQL cannot be inputs to other expressions
	if neededNode.NodeType() == TypeCMDNode {
		depCMD := neededNode.(*CMDNode)
		if depCMD.CMDType == TypeClassicConditions {
			return fmt.Errorf("classic conditions may not be the input for other expressions, but %v is the input for %v", neededVar, cmdNode.RefID())
		}
		if depCMD.CMDType == TypeSQL {
			return fmt.Errorf("sql expressions can not be the input for other expressions, but %v in the input for %v", neededVar, cmdNode.RefID())
		}
	}

	return nil
}

// buildAllEdges validates and builds edges for all CMD nodes in the graph.
// Valid edges are added to the graph. Returns per-node errors for invalid edges.
func buildAllEdges(graph *simple.DirectedGraph, registry map[string]Node) []edgeError {
	var errs []edgeError
	nodeIt := graph.Nodes()

	for nodeIt.Next() {
		node := nodeIt.Node().(Node)
		if node.NodeType() != TypeCMDNode {
			continue
		}

		cmdNode := node.(*CMDNode)
		for _, neededVar := range cmdNode.Command.NeedsVars() {
			neededNode, ok := registry[neededVar]
			if !ok {
				errs = append(errs, edgeError{
					RefID: cmdNode.RefID(), NeededVar: neededVar,
					IsMissingDep: true,
					Err:          fmt.Errorf("unable to find dependent node '%v'", neededVar),
				})
				continue
			}

			if err := validateEdgeConstraints(cmdNode, neededNode, neededVar); err != nil {
				errs = append(errs, edgeError{RefID: cmdNode.RefID(), NeededVar: neededVar, Err: err})
				continue
			}

			// Mark DSNode as input to SQL expression for conversion handling
			if _, ok := cmdNode.Command.(*SQLCommand); ok {
				if dsNode, ok := neededNode.(*DSNode); ok {
					dsNode.isInputToSQLExpr = true
				}
			}

			edge := graph.NewEdge(neededNode, cmdNode)
			neededNode.SetInputTo(cmdNode.RefID())
			graph.SetEdge(edge)
		}
	}
	return errs
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
