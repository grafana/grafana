package configchecks

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// nolint:gosec // Defined in defaults.ini originally
	defaultSecretKey = "SW2YcwTIb9zpOOhoPsMm"
)

type securityConfigStep struct {
	securitySection *setting.DynamicSection
}

func (s *securityConfigStep) Title() string {
	return "Security config check"
}

func (s *securityConfigStep) Description() string {
	return "Check if the Grafana security config is set correctly."
}

func (s *securityConfigStep) Resolution() string {
	return "Follow the documentation for each element."
}

func (s *securityConfigStep) ID() string {
	return "security_config"
}

func (s *securityConfigStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	itemPath, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	items := strings.Split(itemPath, ".")
	if len(items) != 2 {
		// Not interested in this item
		return nil, nil
	}
	section, key := items[0], items[1]
	if section != "security" {
		// Only interested in security section
		return nil, nil
	}
	if key == "secret_key" {
		secretKey := s.securitySection.Key("secret_key").Value()
		if secretKey == defaultSecretKey {
			return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				"secret_key",
				itemPath,
				[]advisor.CheckErrorLink{
					{
						Message: "Avoid default value",
						Url:     "https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-database-encryption/",
					},
				},
			)}, nil
		}
	}

	return nil, nil
}
