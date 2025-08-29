package commands

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/urfave/cli/v2"
)

// Operator represents an app operator that is available in the Grafana binary
type Operator struct {
	Name        string
	Description string
	RunFunc     func(standalone.BuildInfo, *cli.Context) error
	Flags       []cli.Flag
}

var operatorsRegistry []Operator

// RegisterOperator registers an app operator that is baked into the Grafana binary
// (This will allow it to be run through the `grafana server operator` command)
func RegisterOperator(operator Operator) {
	operatorsRegistry = append(operatorsRegistry, operator)
}

// OperatorCommand returns the CLI command for running app operators
func OperatorCommand(version, commit, buildBranch, buildstamp string) *cli.Command {
	subcommands := []*cli.Command{
		{
			Name:  "list",
			Usage: "List available integrated operators",
			Action: func(c *cli.Context) error {
				return ListIntegratedOperators()
			},
		},
	}

	for _, operator := range operatorsRegistry {
		operatorCmd := createOperatorCommand(operator, standalone.BuildInfo{
			Version:     version,
			Commit:      commit,
			BuildBranch: buildBranch,
			BuildStamp:  buildstamp,
		})
		subcommands = append(subcommands, operatorCmd)
	}

	return &cli.Command{
		Name:        "operator",
		Usage:       "Run integrated operators and controllers",
		Subcommands: subcommands,
	}
}

// createOperatorCommand creates a CLI command for an operator
func createOperatorCommand(operator Operator, opts standalone.BuildInfo) *cli.Command {
	return &cli.Command{
		Name:  operator.Name,
		Usage: operator.Description,
		Flags: operator.Flags,
		Action: func(c *cli.Context) error {
			return operator.RunFunc(opts, c)
		},
	}
}

// ListIntegratedOperators lists all available operators that can be run through the cli
func ListIntegratedOperators() error {
	if len(operatorsRegistry) == 0 {
		fmt.Println("No operators available.")
		return nil
	}

	fmt.Println("Available operators:")
	fmt.Println()
	for _, operator := range operatorsRegistry {
		fmt.Printf("  %s  - %s\n", operator.Name, operator.Description)
	}
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  grafana server operator <operator-name> [options]")
	fmt.Println()
	fmt.Println("Example:")
	fmt.Println("  grafana server operator provisioning-jobs --arg=my-arg")
	return nil
}
