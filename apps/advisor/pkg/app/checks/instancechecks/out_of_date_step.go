package instancechecks

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Masterminds/semver/v3"
	"github.com/PuerkitoBio/goquery"
	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

var _ checks.Step = &outOfDateVersionStep{}

const (
	outOfDateVersion = "out_of_date_version"
)

type ghReleaseLister interface {
	GetReleaseByTag(ctx context.Context, owner, repo, tag string) (*github.RepositoryRelease, *github.Response, error)
	ListReleases(ctx context.Context, owner, repo string, opts *github.ListOptions) ([]*github.RepositoryRelease, *github.Response, error)
}

type outOfDateVersionStep struct {
	GrafanaVersion string
	ghClient       ghReleaseLister
}

func (s *outOfDateVersionStep) Title() string {
	return "Grafana out-of-date version check"
}

func (s *outOfDateVersionStep) Description() string {
	return "Check if the current Grafana version is out of date."
}

func (s *outOfDateVersionStep) Resolution() string {
	return "Your Grafana instance is running on version " + s.GrafanaVersion + " which is out-of-date.\n" +
		"It is recommended to keep your Grafana instance up to date to ensure you have the latest security patches, bug fixes and features. " +
		"<a href='https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support' target='_blank'>" +
		"Learn more about version support</a>."
}

func (s *outOfDateVersionStep) ID() string {
	return outOfDateVersion
}

func (s *outOfDateVersionStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	item, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if item != outOfDateVersion {
		// Not interested in this item
		return nil, nil
	}

	currentVersion, err := semver.NewVersion(s.GrafanaVersion)
	if err != nil {
		// Unable to parse the version so unable to check if it's out of support
		log.Error("Unable to parse the version", "version", s.GrafanaVersion, "error", err)
		return nil, nil
	}

	releases, err := s.fetchVersionsFromGitHub(ctx, currentVersion)
	if err != nil {
		var err2 error
		releases, err2 = s.fetchVersionsFromWebsite(ctx)
		if err2 != nil {
			log.Error("Unable to fetch the Grafana versions", "github_error", err, "website_error", err2)
			return nil, nil
		}

		log.Warn("Unable to fetch the Grafana versions from GitHub, falling back to website", "error", err)
	}

	// Check the latest patch, minor and major versions.
	latestSecurityPatch := *currentVersion
	latestPatch := *currentVersion
	latestMinor := *currentVersion
	latestMajor := *currentVersion

	for _, release := range releases {
		// Find the latest security patch.
		if release.Major() == latestSecurityPatch.Major() && release.Minor() == latestSecurityPatch.Minor() && release.Patch() == latestSecurityPatch.Patch() && release.Metadata() != latestSecurityPatch.Metadata() {
			currentSecurityRelease, err := parseSecurityRelease(currentVersion.Metadata())
			if err != nil {
				log.Error("Unable to parse current version security release metadata", "version", currentVersion.String(), "error", err)
				continue
			}

			upstreamSecurityRelease, err := parseSecurityRelease(release.Metadata())
			if err != nil {
				log.Error("Unable to parse release version security release metadata", "version", release.String(), "error", err)
				continue
			}

			if upstreamSecurityRelease > currentSecurityRelease {
				latestSecurityPatch = *release
			}
		}

		// Find the latest patch version.
		if release.Major() == latestPatch.Major() && release.Minor() == latestPatch.Minor() && release.Patch() > latestPatch.Patch() {
			latestPatch = *release
		}

		// Find the latest minor version.
		if release.Major() == latestMinor.Major() {
			if release.Minor() > latestMinor.Minor() {
				latestMinor = *release
			} else if release.Minor() == latestMinor.Minor() && release.Patch() > latestMinor.Patch() {
				latestMinor = *release
			}
		}

		// Find the latest major version.
		{
			if release.Major() > latestMajor.Major() {
				latestMajor = *release
			} else if release.Major() == latestMajor.Major() {
				if release.Minor() > latestMajor.Minor() {
					latestMajor = *release
				} else if release.Minor() == latestMajor.Minor() && release.Patch() > latestMajor.Patch() {
					latestMajor = *release
				}
			}
		}
	}

	reportFailures := make([]advisor.CheckReportFailure, 0)

	if latestMajor.Major() > currentVersion.Major() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh, // change this depending on whether the current major is still supported
				s.ID(),
				fmt.Sprintf("There's a new major version available: %s", latestMajor.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Upgrade to the latest major version",
						Url:     "https://grafana.com/grafana/download/" + latestMajor.String(),
					},
				},
			),
		)
	}

	if latestMinor.Minor() > currentVersion.Minor() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh, // change this depending on whether the current minor is still supported
				s.ID(),
				fmt.Sprintf("There's a new minor version available: %s", latestMinor.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Download",
						Url:     "https://grafana.com/grafana/download/" + latestMinor.String(),
					},
				},
			),
		)
	}

	if latestPatch.Patch() > currentVersion.Patch() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("New patch version available: %s", latestPatch.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Download",
						Url:     "https://grafana.com/grafana/download/" + latestPatch.String(),
					},
				},
			),
		)
	}

	if latestSecurityPatch.Patch() == currentVersion.Patch() && latestSecurityPatch.Metadata() != currentVersion.Metadata() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("New security patch available: %s", latestSecurityPatch.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Upgrade now",
						Url:     "https://grafana.com/grafana/download/" + latestSecurityPatch.String(),
					},
				},
			),
		)
	}

	if len(reportFailures) == 0 {
		return nil, nil
	}

	return reportFailures, nil
}

// From a version such as 12.0.1+security-01, security-01 is the metadata part.
func parseSecurityRelease(metadata string) (int, error) {
	if metadata == "" {
		return 0, nil
	}

	security, release, found := strings.Cut(metadata, "-")
	if !found {
		return 0, fmt.Errorf("invalid metadata format: %s", metadata)
	}

	if security != "security" {
		return 0, fmt.Errorf("invalid metadata security tag: %s", security)
	}

	releaseNumber, err := strconv.Atoi(release)
	if err != nil {
		return 0, fmt.Errorf("invalid metadata release number: %s", release)
	}

	return releaseNumber, nil
}

func (s *outOfDateVersionStep) fetchVersionsFromGitHub(ctx context.Context, currentVersion *semver.Version) ([]*semver.Version, error) {
	releases := make([]*semver.Version, 0)
	for page := 1; ; page++ {
		ghReleases, _, err := s.ghClient.ListReleases(ctx, "grafana", "grafana", &github.ListOptions{
			Page:    page,
			PerPage: 100,
		})
		if err != nil {
			// Unable to get the release info so unable to check if it's out of support
			return nil, fmt.Errorf("unable to get the release info: %w", err)
		}

		if len(ghReleases) == 0 {
			// No more releases
			break
		}

		for _, release := range ghReleases {
			releaseVersion, err := semver.NewVersion(release.GetTagName())
			if err != nil {
				return nil, fmt.Errorf("unable to parse the release version %s: %w", release.GetTagName(), err)
			}

			if releaseVersion.LessThan(currentVersion) {
				continue
			}

			releases = append(releases, releaseVersion)
		}
	}

	return releases, nil
}

func (s *outOfDateVersionStep) fetchVersionsFromWebsite(ctx context.Context) ([]*semver.Version, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://grafana.com/grafana/download", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch versions: %w", err)
	}

	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch versions: %s", res.Status)
	}

	doc, err := goquery.NewDocumentFromReader(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// very fragile, but doesn't seem to have changed in a while
	sel := doc.Find("div.download-info-table > div > div:nth-child(1) > div.download-info-table__row_value > div > select > option")

	versions := make([]*semver.Version, 0)
	for _, selection := range sel.EachIter() {
		versionText := selection.Text()
		if versionText == "" {
			continue
		}

		version, err := semver.NewVersion(versionText)
		if err != nil {
			return nil, fmt.Errorf("invalid version format: %s, error: %w", versionText, err)
		}

		versions = append(versions, version)
	}

	return versions, nil
}
