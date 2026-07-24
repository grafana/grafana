package validator

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsVariableReference(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"dollar brace", "${prometheus}", true},
		{"dollar simple", "$datasource", true},
		{"double bracket", "[[prometheus]]", true},
		{"concrete uid", "abcd1234", false},
		{"empty string", "", false},
		{"dollar only", "$", false},
		{"empty braces", "${}", false},
		{"number start", "$123", true},            // Changed: Grafana ACCEPTS digits (per \w+ regex)
		{"all digits", "$999", true},              // New: All digits are valid per \w+
		{"special chars dash", "$ds-name", false}, // Changed: Grafana REJECTS dashes (not in \w)
		{"underscore", "$DS_PROMETHEUS", true},
		{"complex variable", "${DS_PROMETHEUS}", true},
		{"simple letter", "$p", true},
		{"with fieldpath", "${var.field}", true},   // New: Test fieldPath syntax
		{"with format", "[[var:text]]", true},      // New: Test format syntax
		{"brace with format", "${var:json}", true}, // New: Test brace format syntax
		{"digit in brackets", "[[123]]", true},     // New: Digits allowed in all patterns
		{"empty brackets", "[[]]", false},          // New: Empty brackets rejected
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isVariableReference(tt.input)
			require.Equal(t, tt.expected, result, "isVariableReference(%q) returned unexpected result", tt.input)
		})
	}
}

func TestExtractVariableName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"dollar brace", "${prometheus}", "prometheus"},
		{"dollar simple", "$datasource", "datasource"},
		{"double bracket", "[[prometheus]]", "prometheus"},
		{"not variable", "concrete-uid", ""},
		{"empty", "", ""},
		{"complex name", "${DS_PROMETHEUS}", "DS_PROMETHEUS"},
		{"with underscore", "$DS_NAME", "DS_NAME"},
		{"digit variable", "$123", "123"},                    // New: Digits are valid
		{"with fieldpath", "${var.field}", "var"},            // Changed: Extract only name, not fieldPath
		{"with format brace", "${var:json}", "var"},          // Changed: Extract only name, not format
		{"with format bracket", "[[var:text]]", "var"},       // Changed: Extract only name, not format
		{"fieldpath and format", "${var.field:json}", "var"}, // New: Extract only name from complex syntax
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractVariableName(tt.input)
			require.Equal(t, tt.expected, result, "extractVariableName(%q) returned unexpected result", tt.input)
		})
	}
}

func TestIsPrometheusVariable(t *testing.T) {
	// Dashboard with Prometheus __inputs
	dashboardWithPrometheus := map[string]interface{}{
		"__inputs": []interface{}{
			map[string]interface{}{
				"name":     "DS_PROMETHEUS",
				"type":     "datasource",
				"pluginId": "prometheus",
			},
		},
	}

	// Dashboard with MySQL __inputs
	dashboardWithMySQL := map[string]interface{}{
		"__inputs": []interface{}{
			map[string]interface{}{
				"name":     "DS_MYSQL",
				"type":     "datasource",
				"pluginId": "mysql",
			},
		},
	}

	// Dashboard without __inputs
	dashboardWithoutInputs := map[string]interface{}{
		"title": "Test Dashboard",
	}

	tests := []struct {
		name      string
		varRef    string
		dashboard map[string]interface{}
		expected  bool
	}{
		{"prometheus variable with inputs", "${DS_PROMETHEUS}", dashboardWithPrometheus, true},
		{"prometheus simple var", "$DS_PROMETHEUS", dashboardWithPrometheus, true},
		{"mysql variable", "${DS_MYSQL}", dashboardWithMySQL, false},
		{"not variable", "concrete-uid", dashboardWithPrometheus, false},
		{"variable without inputs", "${prometheus}", dashboardWithoutInputs, true}, // Fallback to true for MVP
		{"wrong variable name", "${OTHER}", dashboardWithPrometheus, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPrometheusVariable(tt.varRef, tt.dashboard)
			require.Equal(t, tt.expected, result, "isPrometheusVariable(%q, dashboard) returned unexpected result", tt.varRef)
		})
	}
}

func TestResolveDatasourceUID(t *testing.T) {
	singleUID := "prom-uid-123"

	dashboardWithPrometheus := map[string]interface{}{
		"__inputs": []interface{}{
			map[string]interface{}{
				"name":     "DS_PROMETHEUS",
				"type":     "datasource",
				"pluginId": "prometheus",
			},
		},
	}

	dashboardWithMySQL := map[string]interface{}{
		"__inputs": []interface{}{
			map[string]interface{}{
				"name":     "DS_MYSQL",
				"type":     "datasource",
				"pluginId": "mysql",
			},
		},
	}

	tests := []struct {
		name        string
		uid         string
		dashboard   map[string]interface{}
		expectedUID string
		description string
	}{
		{"concrete uid", "concrete-123", dashboardWithPrometheus, "concrete-123", "should return concrete UID as-is"},
		{"prometheus variable", "${DS_PROMETHEUS}", dashboardWithPrometheus, singleUID, "should resolve to single datasource UID"},
		{"prometheus simple var", "$DS_PROMETHEUS", dashboardWithPrometheus, singleUID, "should resolve simple $ syntax"},
		{"mysql variable", "${DS_MYSQL}", dashboardWithMySQL, "${DS_MYSQL}", "should return non-Prometheus variable as-is"},
		{"empty uid", "", dashboardWithPrometheus, "", "should return empty string as-is"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := resolveDatasourceUID(tt.uid, singleUID, tt.dashboard)
			require.Equal(t, tt.expectedUID, result, "resolveDatasourceUID(%q, %q, dashboard): %s", tt.uid, singleUID, tt.description)
		})
	}
}
