package configchecks

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
)

const annotationsRetentionTTLItem = "annotations.retention_ttl"

// defaultRetentionTTL mirrors the default shipped in defaults.ini.
const defaultRetentionTTL = 2160 * time.Hour

type annotationsConfigStep struct {
	appPlatformSection *setting.DynamicSection
}

func (s *annotationsConfigStep) Title() string {
	return "Annotations config check"
}

func (s *annotationsConfigStep) Description() string {
	return "Checks if the annotations configuration is set correctly."
}

func (s *annotationsConfigStep) Resolution() string {
	return "Follow the documentation for each element."
}

func (s *annotationsConfigStep) ID() string {
	return "annotations_config"
}

func (s *annotationsConfigStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	itemPath, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if itemPath != annotationsRetentionTTLItem {
		// Only interested in the annotations retention TTL item
		return nil, nil
	}

	// alert if retention_ttl is set as the default value
	if s.appPlatformSection.Key("retention_ttl").MustDuration(defaultRetentionTTL) == defaultRetentionTTL {
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			"retention_ttl",
			itemPath,
			[]advisor.CheckErrorLink{
				{
					Message: "Evaluate default value",
					// TODO: This is a placeholder. Update this to the correct path once available.
					Url: "https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#annotations",
				},
			},
		)}, nil
	}

	return nil, nil
}
