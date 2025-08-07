package secretsconsolidation

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/server"
)

func ConsolidateSecrets(_ utils.CommandLine, runner server.Runner) error {
	err := runner.SecretsConsolidationService.Consolidate(context.Background())
	return err
}
