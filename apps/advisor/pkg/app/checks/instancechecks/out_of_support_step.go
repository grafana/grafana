package instancechecks

import (
	"context"
	"fmt"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

var _ checks.Step = &outOfSupportVersionStep{}

const (
	outOfSupportVersion = "out_of_support_version"
)

type outOfSupportVersionStep struct {
	GrafanaVersion string
	BuildDate      time.Time
	ghClient       gitHubClient
}

func (s *outOfSupportVersionStep) Title() string {
	return "Grafana version check"
}

func (s *outOfSupportVersionStep) Description() string {
	return "Check if the current Grafana version is out of support."
}

func (s *outOfSupportVersionStep) Resolution() string {
	return "Out of support versions will not receive security updates or bug fixes. " +
		"Upgrade to a more recent version. " +
		"<a href='https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support' target='_blank'>" +
		"Learn more about version support</a>."
}

func (s *outOfSupportVersionStep) ID() string {
	return outOfSupportVersion
}

func (s *outOfSupportVersionStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	item, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if item != outOfSupportVersion {
		// Not interested in this item
		return nil, nil
	}

	// If the build date is less than 9 months old, it's supported
	if s.BuildDate.After(time.Now().AddDate(0, -9, 0)) {
		return nil, nil
	}

	// If the build date is older than 15 months, it's not supported
	isOutOfSupport := false
	if s.BuildDate.Before(time.Now().AddDate(0, -15, 0)) {
		isOutOfSupport = true
	} else {
		// In other cases, we need to check if the version is out of support.
		// Minor versions are generally supported for 9 months but the last
		// minor version for a major version is supported for 15 months.
		// This is the case when we keep doing releases for old minor versions (e.g. 11.x when 12.x is out).
		// https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support

		// Parse the current version using semver
		version, err := semver.NewVersion(s.GrafanaVersion)
		if err != nil {
			// Unable to parse the version so unable to check if it's out of support
			log.Error("Unable to parse the version", "version", s.GrafanaVersion, "error", err)
			return nil, nil
		}

		// To verify if the current version is the latest minor version for this major version,
		// we try to get the version vX.Y+1.0 from GitHub
		nextMinorVersion := fmt.Sprintf("v%d.%d.0", version.Major(), version.Minor()+1)
		_, res, err := s.ghClient.GetReleaseByTag(ctx, "grafana", "grafana", nextMinorVersion)
		if err != nil && res.StatusCode != 404 {
			// Unable to get the release info so unable to check if it's out of support
			log.Error("Unable to get the release info", "version", s.GrafanaVersion, "error", err.Error())
			return nil, nil
		}
		latestMinor := false
		if res.StatusCode == 404 {
			// No next minor version found, so the current version is the latest minor version
			latestMinor = true
		}

		// Calculate support end date
		supportMonths := 9
		if latestMinor {
			supportMonths = 15 // Extended support for last minor version
		}

		supportEndDate := s.BuildDate.AddDate(0, supportMonths, 0)
		if time.Now().After(supportEndDate) {
			isOutOfSupport = true
		}
	}

	if isOutOfSupport {
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			fmt.Sprintf("Grafana version %s is out of support", s.GrafanaVersion),
			outOfSupportVersion,
			[]advisor.CheckErrorLink{},
		)}, nil
	}
	return nil, nil
}

// gitHubClient is a mockable interface for the GitHub client
type gitHubClient interface {
	GetReleaseByTag(ctx context.Context, owner, repo, tag string) (*github.RepositoryRelease, *github.Response, error)
}
