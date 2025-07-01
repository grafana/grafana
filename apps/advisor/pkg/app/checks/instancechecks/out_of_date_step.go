package instancechecks

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana-app-sdk/logging"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

var _ checks.Step = &outOfDateVersionStep{}

const (
	outOfDateVersion = "out_of_date_version"
)

type releaseDetails struct {
	releaseDate  time.Time
	releaseNotes string
}

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

	releases, err := s.fetchVersionsFromGrafanaAPI(ctx, currentVersion)
	if err != nil {
		var gerr error
		releases, gerr = s.fetchVersionsFromGitHub(ctx, currentVersion)
		if gerr != nil {
			log.Error("Unable to fetch the Grafana versions", "github_error", err, "website_error", gerr)
			return nil, nil
		}

		log.Warn("Unable to fetch the Grafana versions from GitHub, falling back to Grafana website", "error", err)
	}

	versionInfo := s.parseVersionInfo(*currentVersion, slices.Collect(maps.Keys(releases)), log)

	reportFailures := make([]advisor.CheckReportFailure, 0)
	uniqueReportedVersions := make(map[string]struct{})

	severity := advisor.CheckReportFailureSeverityHigh
	if s.isVersionSupported(*currentVersion, releases) {
		severity = advisor.CheckReportFailureSeverityLow
	}

	// Report failures for all newer major versions
	for majorVersion, latestVersionForMajor := range versionInfo.latestMajorVersions {
		versionString := latestVersionForMajor.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[latestVersionForMajor].releaseDate

			reportFailures = append(
				reportFailures,
				checks.NewCheckReportFailure(
					severity,
					s.ID(),
					fmt.Sprintf("There's a new major version %s released on %s", versionString, releaseDate.Format(time.DateOnly)),
					outOfDateVersion,
					[]advisor.CheckErrorLink{
						{
							Message: fmt.Sprintf("Upgrade to major version %d", majorVersion) + s.oosMsg(latestVersionForMajor, releases),
							Url:     "https://grafana.com/grafana/download/" + versionString,
						},
					},
				),
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report minor version updates
	if versionInfo.latestMinor.Minor() > currentVersion.Minor() {
		versionString := versionInfo.latestMinor.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestMinor].releaseDate

			reportFailures = append(
				reportFailures,
				checks.NewCheckReportFailure(
					severity,
					s.ID(),
					fmt.Sprintf("There's a new minor version %s released on %s", versionString, releaseDate.Format(time.DateOnly)),
					outOfDateVersion,
					[]advisor.CheckErrorLink{
						{
							Message: "Download" + s.oosMsg(versionInfo.latestMinor, releases),
							Url:     "https://grafana.com/grafana/download/" + versionString,
						},
					},
				),
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report patch version updates
	if versionInfo.latestPatch.Patch() > currentVersion.Patch() {
		versionString := versionInfo.latestPatch.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestPatch].releaseDate

			reportFailures = append(
				reportFailures,
				checks.NewCheckReportFailure(
					severity,
					s.ID(),
					fmt.Sprintf("New patch version %s released on %s", versionString, releaseDate.Format(time.DateOnly)),
					outOfDateVersion,
					[]advisor.CheckErrorLink{
						{
							Message: "Upgrade now" + s.oosMsg(versionInfo.latestPatch, releases),
							Url:     "https://grafana.com/grafana/download/" + versionString,
						},
					},
				),
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report security patch updates
	if versionInfo.latestSecurityPatch.Patch() == currentVersion.Patch() && versionInfo.latestSecurityPatch.Metadata() != currentVersion.Metadata() {
		versionString := versionInfo.latestSecurityPatch.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestSecurityPatch].releaseDate

			reportFailures = append(
				reportFailures,
				checks.NewCheckReportFailure(
					severity,
					s.ID(),
					fmt.Sprintf("New security patch %s released on %s", versionString, releaseDate.Format(time.DateOnly)),
					outOfDateVersion,
					[]advisor.CheckErrorLink{
						{
							Message: "Upgrade now" + s.oosMsg(versionInfo.latestSecurityPatch, releases),
							Url:     "https://grafana.com/grafana/download/" + versionString,
						},
					},
				),
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
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

func (s *outOfDateVersionStep) parseVersionInfo(currentVersion semver.Version, releases []semver.Version, log logging.Logger) *versionInfo {
	info := &versionInfo{
		latestSecurityPatch: currentVersion,
		latestPatch:         currentVersion,
		latestMinor:         currentVersion,
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
				info.latestSecurityPatch = release
			}
		}

		// Find the latest patch version.
		if release.Major() == info.latestPatch.Major() && release.Minor() == info.latestPatch.Minor() && release.Patch() > info.latestPatch.Patch() {
			info.latestPatch = release
		}

		// Find the latest minor version.
		if release.Major() == info.latestMinor.Major() {
			if release.Minor() > info.latestMinor.Minor() {
				info.latestMinor = release
			} else if release.Minor() == info.latestMinor.Minor() && release.Patch() > info.latestMinor.Patch() {
				info.latestMinor = release
			}
		}

		// Find the latest version for each major version that's newer than current.
		if release.Major() > currentVersion.Major() {
			if existing, exists := info.latestMajorVersions[release.Major()]; !exists {
				info.latestMajorVersions[release.Major()] = release
			} else {
				// Update if this release is newer than the existing one for this major
				if release.Minor() > existing.Minor() {
					info.latestMajorVersions[release.Major()] = release
				} else if release.Minor() == existing.Minor() && release.Patch() > existing.Patch() {
					info.latestMajorVersions[release.Major()] = release
				}
			}
		}
	}

	// Keep only the last 2 newer major versions
	if len(info.latestMajorVersions) > 2 {
		majorVersions := make([]uint64, 0, len(info.latestMajorVersions))
		for major := range info.latestMajorVersions {
			majorVersions = append(majorVersions, major)
		}

		slices.SortFunc(majorVersions, func(a, b uint64) int {
			return int(b - a)
		})

		for _, major := range majorVersions[2:] {
			delete(info.latestMajorVersions, major)
		}
	}

	return info
}

func (s *outOfDateVersionStep) fetchVersionsFromGitHub(ctx context.Context, currentVersion *semver.Version) (map[semver.Version]*releaseDetails, error) {
	releases := make(map[semver.Version]*releaseDetails, 0)

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

			releases[*releaseVersion] = &releaseDetails{
				releaseDate:  release.GetPublishedAt().Time.UTC(),
				releaseNotes: release.GetHTMLURL(),
			}
		}
	}

	return releases, nil
}

func (s *outOfDateVersionStep) fetchVersionsFromGrafanaAPI(ctx context.Context, currentVersion *semver.Version) (map[semver.Version]*releaseDetails, error) {
	type grafanaAPIResponse struct {
		Versions []struct {
			Channels struct {
				Stable bool `json:"stable"`
			} `json:"channels"`

			Product     string `json:"product"`
			ReleaseDate string `json:"releaseDate"`
			Version     string `json:"version"`
			WhatsNewURL string `json:"whatsNewUrl"`
		} `json:"items"`
	}

	const product = "grafana"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://grafana.com/api/"+product+"/versions", nil)
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

	var apiResponse grafanaAPIResponse
	if err := json.NewDecoder(res.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	releases := make(map[semver.Version]*releaseDetails, 0)

	for _, releaseVersion := range apiResponse.Versions {
		if !releaseVersion.Channels.Stable || releaseVersion.Product != product {
			continue
		}

		version, err := semver.NewVersion(releaseVersion.Version)
		if err != nil {
			return nil, fmt.Errorf("invalid version format: %s, error: %w", releaseVersion.Version, err)
		}

		// If we find a single version that's older than the current version, we can stop here because the API is sorted by version in descending order.
		if version.LessThan(currentVersion) {
			break
		}

		releaseDate, err := time.Parse(time.RFC3339, releaseVersion.ReleaseDate)
		if err != nil {
			return nil, fmt.Errorf("invalid release date format: %s, error: %w", releaseVersion.ReleaseDate, err)
		}

		releases[*version] = &releaseDetails{
			releaseDate:  releaseDate,
			releaseNotes: releaseVersion.WhatsNewURL,
		}
	}

	return releases, nil
}

func (s *outOfDateVersionStep) findLatestMajor(releases map[semver.Version]*releaseDetails) uint64 {
	latestMajor := uint64(0)
	for version := range releases {
		if version.Major() > latestMajor {
			latestMajor = version.Major()
		}
	}
	return latestMajor
}

func (s *outOfDateVersionStep) findLatestMinorForMajor(major uint64, releases map[semver.Version]*releaseDetails) uint64 {
	latestMinor := uint64(0)
	for version := range releases {
		if version.Major() == major && version.Minor() > latestMinor {
			latestMinor = version.Minor()
		}
	}
	return latestMinor
}

func (s *outOfDateVersionStep) isVersionSupported(version semver.Version, releases map[semver.Version]*releaseDetails) bool {
	releaseDetails, ok := releases[version]
	if !ok {
		return false
	}

	latestOverallMajor := s.findLatestMajor(releases)

	// Only support versions from the latest major and the previous major (N-1)
	if version.Major() < latestOverallMajor-1 {
		return false
	}

	if version.Major() == latestOverallMajor-1 {
		latestMinorForMajor := s.findLatestMinorForMajor(version.Major(), releases)

		// Latest minor of previous major gets 15 months support
		if version.Minor() == latestMinorForMajor {
			return time.Now().Before(releaseDetails.releaseDate.AddDate(0, 15, 0))
		}
	}

	// All other versions get 9 months of support
	return time.Now().Before(releaseDetails.releaseDate.AddDate(0, 9, 0))
}

func (s *outOfDateVersionStep) oosMsg(version semver.Version, releases map[semver.Version]*releaseDetails) string {
	if s.isVersionSupported(version, releases) {
		return ""
	}
	return " (OUT OF SUPPORT)"
}
