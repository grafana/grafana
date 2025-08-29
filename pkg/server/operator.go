package server

import (
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"
)

// Operator represents an app operator that is available in the Grafana binary
type Operator struct {
	Name        string
	Description string
	RunFunc     func(standalone.BuildInfo, *cli.Context, *setting.Cfg) error
}

var operatorsRegistry []Operator

// RegisterOperator registers an app operator that is baked into the Grafana binary
func RegisterOperator(operator Operator) {
	operatorsRegistry = append(operatorsRegistry, operator)
}

// GetRegisteredOperators returns all registered operators
func GetRegisteredOperators() []Operator {
	return operatorsRegistry
}

// GetRegisteredOperatorNames returns the names of all registered operators
func GetRegisteredOperatorNames() []string {
	names := make([]string, len(operatorsRegistry))
	for i, op := range operatorsRegistry {
		names[i] = op.Name
	}
	return names
}
