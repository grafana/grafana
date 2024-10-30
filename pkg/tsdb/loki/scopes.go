package loki

import "github.com/grafana/grafana/pkg/promlib/models"

func ApplyScopes(rawExpr string, scopeFilters []models.ScopeFilter) (string, error) {
	return rawExpr, nil
}
