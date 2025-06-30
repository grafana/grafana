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

type versionInfo struct {
	latestSecurityPatch semver.Version
	latestPatch         semver.Version
	latestMinor         semver.Version
	latestMajorVersions map[uint64]semver.Version
}

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
		return nil, nil
	}

	currentVersion, err := semver.NewVersion(s.GrafanaVersion)
	if err != nil {
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

	versionInfo := s.parseVersionInfo(currentVersion, releases, log)

	reportFailures := make([]advisor.CheckReportFailure, 0)

	for majorVersion, latestVersionForMajor := range versionInfo.latestMajorVersions {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh, // change this depending on whether the current major is still supported
				s.ID(),
				fmt.Sprintf("There's a new major version available: %s", latestVersionForMajor.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: fmt.Sprintf("Upgrade to major version %d", majorVersion),
						Url:     "https://grafana.com/grafana/download/" + latestVersionForMajor.String(),
					},
				},
			),
		)
	}

	if versionInfo.latestMinor.Minor() > currentVersion.Minor() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh, // change this depending on whether the current minor is still supported
				s.ID(),
				fmt.Sprintf("There's a new minor version available: %s", versionInfo.latestMinor.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Download",
						Url:     "https://grafana.com/grafana/download/" + versionInfo.latestMinor.String(),
					},
				},
			),
		)
	}

	if versionInfo.latestPatch.Patch() > currentVersion.Patch() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("New patch version available: %s", versionInfo.latestPatch.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Download",
						Url:     "https://grafana.com/grafana/download/" + versionInfo.latestPatch.String(),
					},
				},
			),
		)
	}

	if versionInfo.latestSecurityPatch.Patch() == currentVersion.Patch() && versionInfo.latestSecurityPatch.Metadata() != currentVersion.Metadata() {
		reportFailures = append(
			reportFailures,
			checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("New security patch available: %s", versionInfo.latestSecurityPatch.String()),
				outOfDateVersion,
				[]advisor.CheckErrorLink{
					{
						Message: "Upgrade now",
						Url:     "https://grafana.com/grafana/download/" + versionInfo.latestSecurityPatch.String(),
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

func (s *outOfDateVersionStep) parseVersionInfo(currentVersion *semver.Version, releases []*semver.Version, log logging.Logger) *versionInfo {
	info := &versionInfo{
		latestSecurityPatch: *currentVersion,
		latestPatch:         *currentVersion,
		latestMinor:         *currentVersion,
		latestMajorVersions: make(map[uint64]semver.Version),
	}

	for _, release := range releases {
		// Find the latest security patch.
		if release.Major() == info.latestSecurityPatch.Major() && release.Minor() == info.latestSecurityPatch.Minor() && release.Patch() == info.latestSecurityPatch.Patch() && release.Metadata() != info.latestSecurityPatch.Metadata() {
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
				info.latestSecurityPatch = *release
			}
		}

		// Find the latest patch version.
		if release.Major() == info.latestPatch.Major() && release.Minor() == info.latestPatch.Minor() && release.Patch() > info.latestPatch.Patch() {
			info.latestPatch = *release
		}

		// Find the latest minor version.
		if release.Major() == info.latestMinor.Major() {
			if release.Minor() > info.latestMinor.Minor() {
				info.latestMinor = *release
			} else if release.Minor() == info.latestMinor.Minor() && release.Patch() > info.latestMinor.Patch() {
				info.latestMinor = *release
			}
		}

		// Find the latest version for each major version that's newer than current.
		if release.Major() > currentVersion.Major() {
			if existing, exists := info.latestMajorVersions[release.Major()]; !exists {
				info.latestMajorVersions[release.Major()] = *release
			} else {
				// Update if this release is newer than the existing one for this major
				if release.Minor() > existing.Minor() {
					info.latestMajorVersions[release.Major()] = *release
				} else if release.Minor() == existing.Minor() && release.Patch() > existing.Patch() {
					info.latestMajorVersions[release.Major()] = *release
				}
			}
		}
	}

	return info
}

func (s *outOfDateVersionStep) fetchVersionsFromGitHub(ctx context.Context, currentVersion *semver.Version) ([]*semver.Version, error) {
	releases := make([]*semver.Version, 0)
	for page := 1; ; page++ {
		ghReleases, _, err := s.ghClient.ListReleases(ctx, "grafana", "grafana", &github.ListOptions{
			Page:    page,
			PerPage: 100,
		})
		if err != nil {
			return nil, fmt.Errorf("unable to get the release info: %w", err)
		}

		if len(ghReleases) == 0 {
			break
		}

		// GitHub returns releases in reverse chronological order, so we can stop the iterator if the first release on the page is already too old.
		// This is an optimization because of the aggressive rate limiting.
		firstVersionInPage, err := semver.NewVersion(ghReleases[0].GetTagName())
		if err != nil {
			return nil, fmt.Errorf("unable to parse the last release version %s: %w", ghReleases[0].GetTagName(), err)
		}
		if firstVersionInPage.LessThan(currentVersion) {
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
