package secretsmigrations

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/server"
)

func ReEncryptDEKS(_ utils.CommandLine, runner server.Runner) error {
	return runner.SecretsService.ReEncryptDataKeys(context.Background())
}

func ReEncryptSecrets(_ utils.CommandLine, runner server.Runner) error {
	_, err := runner.SecretsMigrator.ReEncryptSecrets(context.Background())
	return err
}

func RollBackSecrets(_ utils.CommandLine, runner server.Runner) error {
	_, err := runner.SecretsMigrator.RollBackSecrets(context.Background())
	return err
}
