package store

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// JSON functions for MySQL/PostgreSQL

func jsonEquals(dialect migrator.Dialect, column, key, value string) (string, []any) {
	switch dialect.DriverName() {
	case migrator.MySQL:
		return fmt.Sprintf("JSON_UNQUOTE(JSON_EXTRACT(NULLIF(%s, ''), CONCAT('$.', ?))) = ?", column), []any{key, value}
	case migrator.Postgres:
		return fmt.Sprintf("jsonb_extract_path_text(NULLIF(%s, '')::jsonb, ?) = ?", column), []any{key, value}
	default:
		return "", nil
	}
}

func jsonNotEquals(dialect migrator.Dialect, column, key, value string) (string, []any) {
	var jx string
	switch dialect.DriverName() {
	case migrator.MySQL:
		jx = fmt.Sprintf("JSON_UNQUOTE(JSON_EXTRACT(NULLIF(%s, ''), CONCAT('$.', ?)))", column)
	case migrator.Postgres:
		jx = fmt.Sprintf("jsonb_extract_path_text(NULLIF(%s, '')::jsonb, ?)", column)
	default:
		return "", nil
	}
	return fmt.Sprintf("(%s IS NULL OR %s != ?)", jx, jx), []any{key, key, value}
}

func jsonKeyMissing(dialect migrator.Dialect, column, key string) (string, []any) {
	switch dialect.DriverName() {
	case migrator.MySQL:
		return fmt.Sprintf("JSON_EXTRACT(NULLIF(%s, ''), CONCAT('$.', ?)) IS NULL", column), []any{key}
	case migrator.Postgres:
		return fmt.Sprintf("jsonb_extract_path_text(NULLIF(%s, '')::jsonb, ?) IS NULL", column), []any{key}
	default:
		return "", nil
	}
}

// GLOB functions for SQLite

func globEquals(column, key, value string) (string, []any, error) {
	pattern, err := buildGlobPattern(key, value)
	if err != nil {
		return "", nil, err
	}
	return column + " GLOB ?", []any{"*" + pattern + "*"}, nil
}

func globNotEquals(column, key, value string) (string, []any, error) {
	pattern, err := buildGlobPattern(key, value)
	if err != nil {
		return "", nil, err
	}
	return column + " NOT GLOB ?", []any{"*" + pattern + "*"}, nil
}

func globKeyMissing(column, key string) (string, []any, error) {
	pattern, err := buildGlobKeyPattern(key)
	if err != nil {
		return "", nil, err
	}
	return column + " NOT GLOB ?", []any{"*" + pattern + "*"}, nil
}

// Search for `"key":"value"`
func buildGlobPattern(key, value string) (string, error) {
	keyJSON, err := json.Marshal(key)
	if err != nil {
		return "", fmt.Errorf("failed to marshal key: %w", err)
	}
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("failed to marshal value: %w", err)
	}
	return escapeGlobPattern(fmt.Sprintf(`%s:%s`, string(keyJSON), string(valueJSON))), nil
}

// Search for `"key":`
func buildGlobKeyPattern(key string) (string, error) {
	keyJSON, err := json.Marshal(key)
	if err != nil {
		return "", fmt.Errorf("failed to marshal key: %w", err)
	}
	return escapeGlobPattern(string(keyJSON) + ":"), nil
}

func escapeGlobPattern(pattern string) string {
	pattern = strings.ReplaceAll(pattern, "[", "[[]")
	pattern = strings.ReplaceAll(pattern, "*", "[*]")
	pattern = strings.ReplaceAll(pattern, "?", "[?]")
	return pattern
}
