package expr

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/expr/mathexp"

	"gonum.org/v1/gonum/graph"
	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"
)

// NodeType is the type of a DPNode. Currently either a GEL or datasource query.
type NodeType int

const (
	// TypeGELNode is a DPNode NodeType for GEL commands.
	TypeGELNode NodeType = iota
	// TypeDatasourceNode is a DPNode NodeType for datasource queries.
	TypeDatasourceNode
)

// Node is a node in a Data Pipeline. Node is either a GEL command or a datasource query.
type Node interface {
	ID() int64 // ID() allows the gonum graph node interface to be fulfilled
	NodeType() NodeType
	RefID() string
	Execute(c context.Context, vars mathexp.Vars) (mathexp.Results, error)
	String() string
}

// DataPipeline is an ordered set of nodes returned from DPGraph processing.
type DataPipeline []Node

// execute runs all the command/datasource requests in the pipeline return a
// map of the refId of the of each command
func (dp *DataPipeline) execute(c context.Context) (mathexp.Vars, error) {
	vars := make(mathexp.Vars)
	for _, node := range *dp {
		res, err := node.Execute(c, vars)
		if err != nil {
			return nil, err
		}

		vars[node.RefID()] = res
	}
	return vars, nil
}

const gelNodeName = "__expr__"

// BuildPipeline builds a graph of the nodes, and returns the nodes in an
// executable order
func buildPipeline(queries []backend.DataQuery) (DataPipeline, error) {
	graph, err := buildDependencyGraph(queries)
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
func buildDependencyGraph(queries []backend.DataQuery) (*simple.DirectedGraph, error) {
	graph, err := buildGraph(queries)
	if err != nil {
		return nil, err
	}

	registry := buildNodeRegistry(graph)

	if err := buildGraphEdges(graph, registry); err != nil {
		return nil, err
	}

	return graph, nil
}

// buildExecutionOrder returns a sequence of nodes ordered by dependency.
func buildExecutionOrder(graph *simple.DirectedGraph) ([]Node, error) {
	sortedNodes, err := topo.Sort(graph)
	if err != nil {
		return nil, err
	}

	nodes := make([]Node, len(sortedNodes))
	for i, v := range sortedNodes {
		nodes[i] = v.(Node)
	}

	return nodes, nil
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
func buildGraph(queries []backend.DataQuery) (*simple.DirectedGraph, error) {
	dp := simple.NewDirectedGraph()

	for _, query := range queries {
		rawQueryProp := make(map[string]interface{})
		err := json.Unmarshal(query.JSON, &rawQueryProp)
		if err != nil {
			return nil, err
		}
		rn := &rawNode{
			Query:     rawQueryProp,
			RefID:     query.RefID,
			TimeRange: query.TimeRange,
			QueryType: query.QueryType,
		}

		dsName, err := rn.GetDatasourceName()
		if err != nil {
			return nil, err
		}

		var node graph.Node
		switch dsName {
		case gelNodeName:
			node, err = buildGELNode(dp, rn)
		default: // If it's not a GEL query, it's a data source query.
			node, err = buildDSNode(dp, rn)
		}
		if err != nil {
			return nil, err
		}
		dp.AddNode(node)
	}
	return dp, nil
}

// buildGraphEdges generates graph edges based on each node's dependencies.
func buildGraphEdges(dp *simple.DirectedGraph, registry map[string]Node) error {
	nodeIt := dp.Nodes()

	for nodeIt.Next() {
		node := nodeIt.Node().(Node)

		if node.NodeType() != TypeGELNode {
			// datasource node, nothing to do for now. Although if we want GEL results to be
			// used as datasource query params some day this will need change
			continue
		}

		gelNode := node.(*GELNode)

		for _, neededVar := range gelNode.GELCommand.NeedsVars() {
			neededNode, ok := registry[neededVar]
			if !ok {
				return fmt.Errorf("unable to find dependent node '%v'", neededVar)
			}

			if neededNode.ID() == gelNode.ID() {
				return fmt.Errorf("can not add self referencing node for var '%v' ", neededVar)
			}

			edge := dp.NewEdge(neededNode, gelNode)

			dp.SetEdge(edge)
		}
	}
	return nil
}
