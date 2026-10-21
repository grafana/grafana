package rbac

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// Bound recursive conversion and subsequent permission/resolver work. Nodes and
// scopes count every occurrence; actions count distinct values across the tree.
const (
	maxLegacyExpressionDepth   = 32
	maxLegacyExpressionNodes   = 1024
	maxLegacyExpressionScopes  = 4096
	maxLegacyExpressionActions = 256
)

func convertLegacyExpression(
	expression *authzextv1.LegacyExpression,
) (accesscontrol.Evaluator, []string, error) {
	converter := legacyExpressionConverter{seenActions: make(map[string]struct{})}

	evaluator, err := converter.convert(expression, 1)
	if err != nil {
		return nil, nil, err
	}

	return evaluator, converter.actions, nil
}

type legacyExpressionConverter struct {
	nodes  int
	scopes int

	actions     []string
	seenActions map[string]struct{}
}

func (c *legacyExpressionConverter) convert(
	expression *authzextv1.LegacyExpression,
	depth int,
) (accesscontrol.Evaluator, error) {
	if depth > maxLegacyExpressionDepth {
		return nil, fmt.Errorf("legacy expression exceeds maximum depth (%d)", maxLegacyExpressionDepth)
	}
	if c.nodes >= maxLegacyExpressionNodes {
		return nil, fmt.Errorf("legacy expression exceeds maximum nodes (%d)", maxLegacyExpressionNodes)
	}
	c.nodes++

	switch node := expression.GetNode().(type) {
	case *authzextv1.LegacyExpression_Permission:
		if node == nil || node.Permission == nil {
			return nil, fmt.Errorf("legacy permission is required")
		}
		permission := node.Permission
		if permission.Action == "" {
			return nil, fmt.Errorf("legacy permission action is required")
		}
		if len(permission.Scopes) > maxLegacyExpressionScopes-c.scopes {
			return nil, fmt.Errorf("legacy expression exceeds maximum scopes (%d)", maxLegacyExpressionScopes)
		}
		c.scopes += len(permission.Scopes)
		if _, exists := c.seenActions[permission.Action]; !exists {
			if len(c.actions) >= maxLegacyExpressionActions {
				return nil, fmt.Errorf("legacy expression exceeds maximum distinct actions (%d)", maxLegacyExpressionActions)
			}
			c.seenActions[permission.Action] = struct{}{}
			c.actions = append(c.actions, permission.Action)
		}

		// Protobuf does not distinguish nil and empty repeated fields. Both must
		// produce an action-only evaluator, including during later scope mutation.
		if len(permission.Scopes) == 0 {
			return accesscontrol.EvalPermission(permission.Action), nil
		}
		return accesscontrol.EvalPermission(permission.Action, slices.Clone(permission.Scopes)...), nil
	case *authzextv1.LegacyExpression_All:
		if node == nil {
			return nil, fmt.Errorf("legacy all list is required")
		}
		children, err := c.convertChildren(node.All, depth)
		if err != nil {
			return nil, err
		}
		return accesscontrol.EvalAll(children...), nil
	case *authzextv1.LegacyExpression_Any:
		if node == nil {
			return nil, fmt.Errorf("legacy any list is required")
		}
		children, err := c.convertChildren(node.Any, depth)
		if err != nil {
			return nil, err
		}
		return accesscontrol.EvalAny(children...), nil
	default:
		return nil, fmt.Errorf("legacy expression node is required")
	}
}

func (c *legacyExpressionConverter) convertChildren(
	list *authzextv1.LegacyExpressionList,
	depth int,
) ([]accesscontrol.Evaluator, error) {
	if list == nil {
		return nil, fmt.Errorf("legacy expression list is required")
	}

	// Reject wide trees before allocating their evaluator slice.
	if len(list.Expressions) > maxLegacyExpressionNodes-c.nodes {
		return nil, fmt.Errorf("legacy expression exceeds maximum nodes (%d)", maxLegacyExpressionNodes)
	}

	children := make([]accesscontrol.Evaluator, 0, len(list.Expressions))
	for _, expression := range list.Expressions {
		child, err := c.convert(expression, depth+1)
		if err != nil {
			return nil, err
		}
		children = append(children, child)
	}
	return children, nil
}
