package expr

import (
	"context"
	"fmt"
	"sort"

	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"

	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// ValidatePipeline validates the expression pipeline without executing it.
// It reuses the same node-building (buildNode) and edge-validation
// (validateEdgeConstraints) logic as the execution path, but collects
// per-node errors instead of aborting on the first failure.
// This is intended for the authoring/editing experience so the frontend
// can show per-node validation errors.
func (s *Service) ValidatePipeline(ctx context.Context, req *Request) (*queryV0.PipelineValidation, error) {
	if req != nil && len(req.Headers) == 0 {
		req.Headers = map[string]string{}
	}

	graph := simple.NewDirectedGraph()
	validNodes := make(map[string]Node) // only successfully built nodes
	var nodeValidations []queryV0.NodeValidation
	isValid := true

	// Phase 1: Build all nodes, collecting per-node errors
	for i, query := range req.Queries {
		if query.DataSource == nil || query.DataSource.UID == "" {
			nodeValidations = append(nodeValidations, queryV0.NodeValidation{
				RefID: query.RefID,
				Error: fmt.Sprintf("missing datasource uid in query with refId %v", query.RefID),
			})
			isValid = false
			continue
		}

		rn, err := makeRawNode(query, int64(i))
		if err != nil {
			nodeValidations = append(nodeValidations, queryV0.NodeValidation{
				RefID: query.RefID,
				Error: fmt.Sprintf("failed to process query JSON: %v", err),
			})
			isValid = false
			continue
		}

		nv := queryV0.NodeValidation{
			RefID:    query.RefID,
			NodeType: NodeTypeFromDatasourceUID(query.DataSource.UID).String(),
		}

		if NodeTypeFromDatasourceUID(query.DataSource.UID) == TypeDatasourceNode {
			nv.DatasourceUID = query.DataSource.UID
		}

		result := s.buildNode(ctx, graph, rn, req)
		if result.CmdType != TypeUnknown {
			nv.CmdType = result.CmdType.String()
		}

		if result.Err != nil {
			nv.Error = result.Err.Error()
			isValid = false
		} else {
			graph.AddNode(result.Node)
			validNodes[query.RefID] = result.Node
		}

		nodeValidations = append(nodeValidations, nv)
	}

	// Phase 2: Build edges for valid nodes, collecting per-node edge errors
	registry := buildNodeRegistry(graph)
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
				updateNodeError(&nodeValidations, cmdNode.RefID(),
					fmt.Sprintf("unable to find dependent node '%v'", neededVar))
				isValid = false
				continue
			}

			if err := validateEdgeConstraints(cmdNode, neededNode, neededVar); err != nil {
				updateNodeError(&nodeValidations, cmdNode.RefID(), err.Error())
				isValid = false
				continue
			}

			edge := graph.NewEdge(neededNode, cmdNode)
			graph.SetEdge(edge)
		}
	}

	// Phase 3: Populate DependsOn from successfully built nodes
	for i := range nodeValidations {
		nv := &nodeValidations[i]
		if node, ok := validNodes[nv.RefID]; ok {
			deps := node.NeedsVars()
			if len(deps) > 0 {
				nv.DependsOn = deps
			}
		}
	}

	// Phase 4: Check for cycles via topological sort
	_, err := topo.SortStabilized(graph, nil)
	if err != nil {
		isValid = false
		// The topo error message includes the cycle info
		for i := range nodeValidations {
			if nodeValidations[i].Error == "" {
				nodeValidations[i].Error = fmt.Sprintf("cycle detected in expression graph: %v", err)
			}
		}
	}

	// Sort by RefID for stable output
	sort.Slice(nodeValidations, func(i, j int) bool {
		return nodeValidations[i].RefID < nodeValidations[j].RefID
	})

	return &queryV0.PipelineValidation{
		IsValid: isValid,
		Nodes:   nodeValidations,
	}, nil
}

// updateNodeError appends an error to an existing node validation entry.
func updateNodeError(validations *[]queryV0.NodeValidation, refID, errMsg string) {
	for i := range *validations {
		if (*validations)[i].RefID == refID {
			if (*validations)[i].Error != "" {
				(*validations)[i].Error += "; " + errMsg
			} else {
				(*validations)[i].Error = errMsg
			}
			return
		}
	}
}
