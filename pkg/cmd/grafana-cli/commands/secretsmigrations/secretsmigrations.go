package secretsmigrations

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var logger = log.New("secrets.migrations")

func ReEncryptDEKS(_ utils.CommandLine, runner runner.Runner) error {
	if runner.Features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	return runner.SecretsService.ReEncryptDataKeys(context.Background())
}

func ReEncryptSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if runner.Features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	return runner.SecretsMigrator.ReEncryptSecrets(context.Background())
}

func RollBackSecrets(_ utils.CommandLine, runner runner.Runner) error {
	if runner.Features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	return runner.SecretsMigrator.RollBackSecrets(context.Background())
}
