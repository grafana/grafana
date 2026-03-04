package integrationscheck

import (
	"context"
	"fmt"

	"github.com/Masterminds/semver/v3"
	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

const (
	UpdateStepID = "update"
)

type updateStep struct{}

func (s *updateStep) ID() string {
	return UpdateStepID
}

func (s *updateStep) Title() string {
	return "Update check"
}

func (s *updateStep) Description() string {
	return "Checks if any installed Grafana Cloud integrations have a newer version available."
}

func (s *updateStep) Resolution() string {
	return "There are newer versions available for the integrations listed below. We recommend updating them in the Connections > Integrations section."
}

func (s *updateStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	log = log.With(LogQueryKey, logQueryValue)
	item, ok := it.(*IntegrationItem)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if item == nil {
		return nil, nil
	}

	outdated, err := isOutdated(item.InstalledVersion, item.LatestVersion)
	if err != nil {
		log.Debug("update step: version parse error", "slug", item.Slug, "error", err)
		return nil, nil
	}
	if !outdated {
		return nil, nil
	}

	log.Debug("update step: outdated", "slug", item.Slug, "installed", item.InstalledVersion, "latest", item.LatestVersion)
	return []advisor.CheckReportFailure{
		checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			item.Name,
			item.Slug,
			[]advisor.CheckErrorLink{
				{
					Message: "View integrations",
					Url:     "/connections/infrastructure" + item.Slug,
				},
			},
		),
	}, nil
}

// isOutdated returns true if installed is strictly less than latest (semver comparison).
func isOutdated(installed, latest string) (bool, error) {
	if installed == latest {
		return false, nil
	}
	installedVer, err := semver.NewVersion(installed)
	if err != nil {
		return false, err
	}
	latestVer, err := semver.NewVersion(latest)
	if err != nil {
		return false, err
	}
	return installedVer.Compare(latestVer) < 0, nil
}
