package secretsmigrations

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/secrets"
)

func ReEncryptDEKS(_ utils.CommandLine, runner runner.Runner) error {
	if !runner.SettingsProvider.IsFeatureToggleEnabled(secrets.EnvelopeEncryptionFeatureToggle) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	return runner.SecretsService.ReEncryptDataKeys(context.Background())
}
