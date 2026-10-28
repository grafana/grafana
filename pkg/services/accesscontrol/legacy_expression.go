package accesscontrol

import (
	"errors"
	"fmt"
	"slices"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// Bound recursive serialization, including cyclic or shared evaluator trees.
// Nodes and scopes count every occurrence; actions count distinct values.
const (
	maxLegacyExpressionDepth   = 32
	maxLegacyExpressionNodes   = 1024
	maxLegacyExpressionScopes  = 4096
	maxLegacyExpressionActions = 256
)

// ToLegacyExpression preserves the evaluator tree for a LegacyCheck request.
// Only the built-in permission, ALL and ANY evaluators can be represented by
// the RPC contract; custom evaluators return an error instead of losing behavior.
func ToLegacyExpression(evaluator Evaluator) (*authzextv1.LegacyExpression, error) {
	exporter := legacyExpressionExporter{actions: make(map[string]struct{})}

	return exporter.convert(evaluator, 1)
}

type legacyExpressionExporter struct {
	nodes   int
	scopes  int
	actions map[string]struct{}
}

func (e *legacyExpressionExporter) convert(
	evaluator Evaluator,
	depth int,
) (*authzextv1.LegacyExpression, error) {
	if depth > maxLegacyExpressionDepth {
		return nil, fmt.Errorf("legacy expression exceeds maximum depth (%d)", maxLegacyExpressionDepth)
	}
	if e.nodes >= maxLegacyExpressionNodes {
		return nil, fmt.Errorf("legacy expression exceeds maximum nodes (%d)", maxLegacyExpressionNodes)
	}
	e.nodes++

	// The built-in types have value receivers, so pointers also implement Evaluator.
	switch node := evaluator.(type) {
	case *permissionEvaluator:
		if node == nil {
			return nil, errors.New("legacy permission evaluator is required")
		}
		evaluator = *node
	case *allEvaluator:
		if node == nil {
			return nil, errors.New("legacy all evaluator is required")
		}
		evaluator = *node
	case *anyEvaluator:
		if node == nil {
			return nil, errors.New("legacy any evaluator is required")
		}
		evaluator = *node
	}

	switch node := evaluator.(type) {
	case permissionEvaluator:
		return e.convertPermission(node)
	case allEvaluator:
		children, err := e.convertChildren(node.allOf, depth)
		if err != nil {
			return nil, err
		}
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_All{All: children},
		}, nil
	case anyEvaluator:
		children, err := e.convertChildren(node.anyOf, depth)
		if err != nil {
			return nil, err
		}
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_Any{Any: children},
		}, nil
	case nil:
		return nil, errors.New("legacy evaluator is required")
	default:
		return nil, fmt.Errorf("unsupported legacy evaluator type: %T", evaluator)
	}
}

func (e *legacyExpressionExporter) convertPermission(
	permission permissionEvaluator,
) (*authzextv1.LegacyExpression, error) {
	if permission.Action == "" {
		return nil, errors.New("legacy permission action is required")
	}

	if len(permission.Scopes) > maxLegacyExpressionScopes-e.scopes {
		return nil, fmt.Errorf("legacy expression exceeds maximum scopes (%d)", maxLegacyExpressionScopes)
	}

	e.scopes += len(permission.Scopes)
	if _, exists := e.actions[permission.Action]; !exists {
		if len(e.actions) >= maxLegacyExpressionActions {
			return nil, fmt.Errorf("legacy expression exceeds maximum distinct actions (%d)", maxLegacyExpressionActions)
		}
		e.actions[permission.Action] = struct{}{}
	}

	return &authzextv1.LegacyExpression{
		Node: &authzextv1.LegacyExpression_Permission{
			Permission: &authzextv1.LegacyPermission{
				Action: permission.Action,
				Scopes: slices.Clone(permission.Scopes),
			},
		},
	}, nil
}

func (e *legacyExpressionExporter) convertChildren(
	evaluators []Evaluator,
	depth int,
) (*authzextv1.LegacyExpressionList, error) {
	// Reject wide trees before allocating their expression slice.
	if len(evaluators) > maxLegacyExpressionNodes-e.nodes {
		return nil, fmt.Errorf("legacy expression exceeds maximum nodes (%d)", maxLegacyExpressionNodes)
	}

	children := make([]*authzextv1.LegacyExpression, 0, len(evaluators))
	for _, evaluator := range evaluators {
		child, err := e.convert(evaluator, depth+1)
		if err != nil {
			return nil, err
		}
		children = append(children, child)
	}

	return &authzextv1.LegacyExpressionList{Expressions: children}, nil
}
