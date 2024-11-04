package loki

import (
	"fmt"
<<<<<<< HEAD
=======

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/loki/v3/pkg/logql/syntax"
)
>>>>>>> 9b2a85b825d (make tests pass)

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/loki/v3/pkg/logql/syntax"
)

// ApplyScopes applies the given scope filters to the given raw expression.
func ApplyScopes(rawExpr string, scopeFilters []models.ScopeFilter) (string, error) {
	if len(scopeFilters) == 0 {
		return rawExpr, nil
	}
<<<<<<< HEAD

	scopeMatchers, err := models.FiltersToMatchers(scopeFilters, nil)
	if err != nil {
		return "", fmt.Errorf("failed to convert filters to matchers: %w", err)
	}

	// Need WithoutValidation to allow empty `{}` expressions
=======
	scopeMatchers, err := models.FiltersToMatchers(scopeFilters, nil)

>>>>>>> 9b2a85b825d (make tests pass)
	syntaxTree, err := syntax.ParseExprWithoutValidation(rawExpr)
	if err != nil {
		return "", fmt.Errorf("failed to parse raw expression: %w", err)
	}
<<<<<<< HEAD

=======
>>>>>>> 9b2a85b825d (make tests pass)
	syntaxTree.Walk(func(e syntax.Expr) {
		switch e := e.(type) {
		case *syntax.MatchersExpr:
			// TODO: Key Collisions?
			e.Mts = append(e.Mts, scopeMatchers...)
		default:
		}
	})
	return syntaxTree.String(), nil
}
