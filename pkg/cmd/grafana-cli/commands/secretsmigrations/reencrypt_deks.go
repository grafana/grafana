package secretsmigrations

import (
	"context"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/runner"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func ReEncryptDEKS(_ utils.CommandLine, runner runner.Runner) error {
	if runner.Features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Warn("Envelope encryption is not enabled, quitting...")
		return nil
	}

	return runner.SecretsService.ReEncryptDataKeys(context.Background())
}
