package prometheus

import (
	"fmt"

	"github.com/prometheus/prometheus/promql/parser"
)

// Parser extracts metric names from PromQL queries
type Parser struct{}

// NewParser creates a new PromQL parser
func NewParser() *Parser {
	return &Parser{}
}

// ExtractMetrics parses a PromQL query and extracts all metric names
// For example: "rate(http_requests_total[5m])" returns ["http_requests_total"]
func (p *Parser) ExtractMetrics(query string) ([]string, error) {
	// Parse the PromQL expression
	expr, err := parser.ParseExpr(query)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PromQL query: %w", err)
	}

	// Extract metric names by walking the AST
	metrics := make(map[string]bool) // Use map to deduplicate
	parser.Inspect(expr, func(node parser.Node, _ []parser.Node) error {
		// VectorSelector represents a metric selector like "up" or "up{job="foo"}"
		if vs, ok := node.(*parser.VectorSelector); ok {
			metrics[vs.Name] = true
		}
		// MatrixSelector represents range queries like "up[5m]"
		if ms, ok := node.(*parser.MatrixSelector); ok {
			if vs, ok := ms.VectorSelector.(*parser.VectorSelector); ok {
				metrics[vs.Name] = true
			}
		}
		return nil
	})

	// Convert map to slice
	result := make([]string, 0, len(metrics))
	for metric := range metrics {
		result = append(result, metric)
	}

	return result, nil
}
