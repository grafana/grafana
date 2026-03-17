package expr

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"gonum.org/v1/gonum/graph/simple"
	"gonum.org/v1/gonum/graph/topo"

	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ValidatePipeline validates the expression pipeline without executing it.
// It attempts to build all nodes and edges, collecting per-node errors instead
// of aborting on the first failure. This is intended for the authoring/editing
// experience so the frontend can show per-node validation errors.
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

		rawQueryProp := make(map[string]any)
		queryBytes, err := query.JSON.MarshalJSON()
		if err != nil {
			nodeValidations = append(nodeValidations, queryV0.NodeValidation{
				RefID: query.RefID,
				Error: fmt.Sprintf("failed to marshal query JSON: %v", err),
			})
			isValid = false
			continue
		}

		err = json.Unmarshal(queryBytes, &rawQueryProp)
		if err != nil {
			nodeValidations = append(nodeValidations, queryV0.NodeValidation{
				RefID: query.RefID,
				Error: fmt.Sprintf("failed to unmarshal query JSON: %v", err),
			})
			isValid = false
			continue
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

		nv := queryV0.NodeValidation{
			RefID:    query.RefID,
			NodeType: NodeTypeFromDatasourceUID(query.DataSource.UID).String(),
		}

		var node Node
		switch NodeTypeFromDatasourceUID(query.DataSource.UID) {
		case TypeDatasourceNode:
			nv.DatasourceUID = query.DataSource.UID
			dsNode, dsErr := s.buildDSNode(graph, rn, req)
			if dsNode != nil {
				node = dsNode
			}
			err = dsErr
		case TypeCMDNode:
			cmdNode, cmdErr := buildCMDNode(ctx, rn, s.features, s.cfg)
			if cmdNode != nil {
				nv.CmdType = cmdNode.CMDType.String()
				node = cmdNode
			}
			err = cmdErr
		case TypeMLNode:
			//nolint:staticcheck // not yet migrated to OpenFeature
			if s.features != nil && s.features.IsEnabledGlobally(featuremgmt.FlagMlExpressions) {
				mlNode, mlErr := s.buildMLNode(graph, rn, req)
				if mlNode != nil {
					node = mlNode
				}
				err = mlErr
			}
		}

		if node == nil && err == nil {
			err = fmt.Errorf("unsupported node type '%s'", NodeTypeFromDatasourceUID(query.DataSource.UID))
		}

		if err != nil {
			nv.Error = err.Error()
			isValid = false
		} else {
			graph.AddNode(node)
			validNodes[query.RefID] = node
		}

		nodeValidations = append(nodeValidations, nv)
	}

	// Phase 2: Build edges for valid nodes, collecting per-node edge errors
	nodeIt := graph.Nodes()
	for nodeIt.Next() {
		node := nodeIt.Node().(Node)
		if node.NodeType() != TypeCMDNode {
			continue
		}

		cmdNode := node.(*CMDNode)
		for _, neededVar := range cmdNode.Command.NeedsVars() {
			neededNode, ok := validNodes[neededVar]
			if !ok {
				updateNodeError(&nodeValidations, cmdNode.RefID(),
					fmt.Sprintf("unable to find dependent node '%v'", neededVar))
				isValid = false
				continue
			}

			// Validate edge compatibility (same checks as buildGraphEdges)
			if _, isSQLCmd := cmdNode.Command.(*SQLCommand); isSQLCmd {
				if _, isDSNode := neededNode.(*DSNode); !isDSNode {
					updateNodeError(&nodeValidations, cmdNode.RefID(),
						fmt.Sprintf("only data source queries may be inputs to a sql expression, %v is the input for %v", neededVar, cmdNode.RefID()))
					isValid = false
					continue
				}
			}

			if neededNode.ID() == cmdNode.ID() {
				updateNodeError(&nodeValidations, cmdNode.RefID(),
					fmt.Sprintf("expression '%v' cannot reference itself", neededVar))
				isValid = false
				continue
			}

			if cmdNode.CMDType == TypeClassicConditions {
				if neededNode.NodeType() != TypeDatasourceNode {
					updateNodeError(&nodeValidations, cmdNode.RefID(),
						fmt.Sprintf("only data source queries may be inputs to a classic condition, %v is a %v", neededVar, neededNode.NodeType()))
					isValid = false
					continue
				}
			}

			if neededNode.NodeType() == TypeCMDNode {
				depCMD := neededNode.(*CMDNode)
				if depCMD.CMDType == TypeClassicConditions {
					updateNodeError(&nodeValidations, cmdNode.RefID(),
						fmt.Sprintf("classic conditions may not be the input for other expressions, but %v is the input for %v", neededVar, cmdNode.RefID()))
					isValid = false
					continue
				}
				if depCMD.CMDType == TypeSQL {
					updateNodeError(&nodeValidations, cmdNode.RefID(),
						fmt.Sprintf("sql expressions can not be the input for other expressions, but %v is the input for %v", neededVar, cmdNode.RefID()))
					isValid = false
					continue
				}
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
