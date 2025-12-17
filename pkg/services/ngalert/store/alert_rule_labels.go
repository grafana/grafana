package store

import (
	"fmt"

	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// buildLabelMatcherCondition builds SQL for a label matcher with Prometheus semantics.
// For MySQL/PostgreSQL, it uses JSON functions, and
// for SQLite, it uses GLOB patterns to find matching labels.
func buildLabelMatcherCondition(dialect migrator.Dialect, column string, m *labels.Matcher) (string, []any, error) {
	if dialect.DriverName() == migrator.SQLite {
		return buildLabelMatcherGlob(column, m)
	}
	return buildLabelMatcherJSON(dialect, column, m)
}

func buildLabelMatcherGlob(column string, m *labels.Matcher) (string, []any, error) {
	switch {
	case m.Type == labels.MatchEqual && m.Value == "":
		eqSQL, eqArgs, _ := globEquals(column, m.Name, "")
		missingSQL, missingArgs, _ := globKeyMissing(column, m.Name)
		return "(" + eqSQL + " OR " + missingSQL + ")", append(eqArgs, missingArgs...), nil
	case m.Type == labels.MatchEqual:
		return globEquals(column, m.Name, m.Value)
	case m.Type == labels.MatchNotEqual:
		return globNotEquals(column, m.Name, m.Value)
	default:
		return "", nil, fmt.Errorf("unsupported matcher type: %v", m.Type)
	}
}

func buildLabelMatcherJSON(dialect migrator.Dialect, column string, m *labels.Matcher) (string, []any, error) {
	switch {
	case m.Type == labels.MatchEqual && m.Value == "":
		eqSQL, eqArgs := jsonEquals(dialect, column, m.Name, "")
		missingSQL, missingArgs := jsonKeyMissing(dialect, column, m.Name)
		return "(" + eqSQL + " OR " + missingSQL + ")", append(eqArgs, missingArgs...), nil
	case m.Type == labels.MatchEqual:
		sql, args := jsonEquals(dialect, column, m.Name, m.Value)
		return sql, args, nil
	case m.Type == labels.MatchNotEqual:
		sql, args := jsonNotEquals(dialect, column, m.Name, m.Value)
		return sql, args, nil
	default:
		return "", nil, fmt.Errorf("unsupported matcher type: %v", m.Type)
	}
}
