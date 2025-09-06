package configchecks

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

const (
	// nolint:gosec // Defined in defaults.ini originally
	defaultSecretsManagerSecretKey = "SW2YcwTIb9zpOOhoPsMm"
)

type secretsManagerConfigStep struct {
	secretsManagerProviders map[string]map[string]string
}

func (s *secretsManagerConfigStep) Title() string {
	return "Secrets Manager config check"
}

func (s *secretsManagerConfigStep) Description() string {
	return "Check if the Grafana Secrets Manager config is set correctly."
}

func (s *secretsManagerConfigStep) Resolution() string {
	return "Follow the documentation for each element."
}

func (s *secretsManagerConfigStep) ID() string {
	return "secrets_manager_config"
}

func (s *secretsManagerConfigStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	itemPath, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	items := strings.SplitN(itemPath, ".", 3)
	if len(items) < 3 {
		return nil, nil
	}
	section, subSection, providerName := items[0], items[1], items[2]
	if section != "secrets_manager" || subSection != "encryption" {
		// Only interested in secrets_manager.encryption section
		return nil, nil
	}

	resCheckReportFailures := []advisor.CheckReportFailure{}

	if _, ok := s.secretsManagerProviders[providerName]; ok {
		if config, ok := s.secretsManagerProviders[providerName]; ok {
			if config["secret_key"] == defaultSecretsManagerSecretKey {
				resCheckReportFailures = append(resCheckReportFailures, checks.NewCheckReportFailure(
					advisor.CheckReportFailureSeverityHigh,
					s.ID(),
					providerName+".secret_key",
					itemPath,
					[]advisor.CheckErrorLink{
						{
							Message: "Avoid default value",
							Url:     "https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-database-encryption/",
						},
					},
				))
			}
		}
	}

	return resCheckReportFailures, nil
}
