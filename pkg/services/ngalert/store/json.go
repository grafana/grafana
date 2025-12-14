package store

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

var (
	errJSONNotSupported = fmt.Errorf("JSON extraction not supported")
	errGlobNotSupported = fmt.Errorf("GLOB pattern matching is not supported")
)

// jsonExtractText returns dialect-specific SQL for extracting a JSON text value.
// The returned SQL contains a ? placeholder for the key parameter.
// Supports only MySQL and PostgreSQL.
func jsonExtractText(dialect migrator.Dialect, column string) (string, error) {
	switch dialect.DriverName() {
	case migrator.MySQL:
		return fmt.Sprintf("JSON_UNQUOTE(JSON_EXTRACT(%s, CONCAT('$.', ?)))", column), nil
	case migrator.Postgres:
		return fmt.Sprintf("jsonb_extract_path_text(%s::jsonb, ?)", column), nil
	default:
		return "", errJSONNotSupported
	}
}

// buildGlobPattern creates a pattern for GLOB (sqlite only) matching for "key":"value"
// Escapes GLOB special characters: * → [*], ? → [?], [ → [[]
func buildGlobPattern(dialect migrator.Dialect, key, value string) (string, error) {
	if dialect.DriverName() != migrator.SQLite {
		return "", errGlobNotSupported
	}

	// Marshal key and value to get proper JSON escaping
	keyJSON, err := json.Marshal(key)
	if err != nil {
		return "", fmt.Errorf("failed to marshal label key: %w", err)
	}
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("failed to marshal label value: %w", err)
	}

	// Build pattern: "key":"value"
	pattern := fmt.Sprintf(`%s:%s`, string(keyJSON), string(valueJSON))

	// Escape GLOB special characters
	pattern = strings.ReplaceAll(pattern, "[", "[[]")
	pattern = strings.ReplaceAll(pattern, "*", "[*]")
	pattern = strings.ReplaceAll(pattern, "?", "[?]")

	return pattern, nil
}
