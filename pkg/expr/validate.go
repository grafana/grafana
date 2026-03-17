package expr

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"gonum.org/v1/gonum/graph/topo"

	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// ValidatePipeline validates the expression pipeline without executing it.
// It calls the same graph-building code path as the execution pipeline
// (buildDependencyGraphAll) but collects all per-node errors and returns
// validation metadata instead of failing on the first error.
func (s *Service) ValidatePipeline(ctx context.Context, req *Request) (*queryV0.PipelineValidation, error) {
	if req != nil && len(req.Headers) == 0 {
		req.Headers = map[string]string{}
	}

	result := s.buildDependencyGraphAll(ctx, req)

	// Check for cycles via topological sort
	_, topoErr := topo.SortStabilized(result.Graph, nil)

	// Index edge errors by refID
	edgeErrMap := make(map[string][]string)
	for _, ee := range result.EdgeErrors {
		edgeErrMap[ee.RefID] = append(edgeErrMap[ee.RefID], ee.Err.Error())
	}

	// Build the validation response
	isValid := true
	nodeValidations := make([]queryV0.NodeValidation, 0, len(result.NodeResults))

	for i, nr := range result.NodeResults {
		query := req.Queries[i]
		nv := queryV0.NodeValidation{RefID: query.RefID}

		// Set type metadata if datasource was present
		if query.DataSource != nil && query.DataSource.UID != "" {
			nv.NodeType = NodeTypeFromDatasourceUID(query.DataSource.UID).String()
			if NodeTypeFromDatasourceUID(query.DataSource.UID) == TypeDatasourceNode {
				nv.DatasourceUID = query.DataSource.UID
			}
		}

		// Set CmdType from built node
		if nr.CmdType != TypeUnknown {
			nv.CmdType = nr.CmdType.String()
		}

		// DependsOn from successfully built nodes
		if nr.Node != nil {
			if deps := nr.Node.NeedsVars(); len(deps) > 0 {
				nv.DependsOn = deps
			}
		}

		// Collect errors: node build errors + edge errors + cycle errors
		var errParts []string
		if nr.Err != nil {
			errParts = append(errParts, nr.Err.Error())
		}
		errParts = append(errParts, edgeErrMap[query.RefID]...)
		if topoErr != nil && len(errParts) == 0 {
			errParts = append(errParts, fmt.Sprintf("cycle detected in expression graph: %v", topoErr))
		}
		if len(errParts) > 0 {
			nv.Error = strings.Join(errParts, "; ")
			isValid = false
		}

		nodeValidations = append(nodeValidations, nv)
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
