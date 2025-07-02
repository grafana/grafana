package app

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
	"github.com/grafana/grafana-app-sdk/resource"
	upgradesv0alpha1 "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type VersionChecker struct {
	log            logging.Logger
	client         resource.Client
	ghClient       ghReleaseLister
	currentVersion string
}

func NewVersionChecker(log logging.Logger, client resource.Client, ghClient ghReleaseLister, currentVersion string) *VersionChecker {
	return &VersionChecker{
		log:            log,
		client:         client,
		ghClient:       ghClient,
		currentVersion: currentVersion,
	}
}

func (v *VersionChecker) Run(ctx context.Context) error {
	logger := v.log.WithContext(ctx)

	logger.Info("Cleaning up old upgrade metadata")
	for continueToken := ""; true; {
		// Delete all "new" upgrade paths and generate new ones -- only the latest set of releases will ever be relevant.
		resp, err := v.client.List(ctx, "default", resource.ListOptions{
			Continue: continueToken,
		})
		if err != nil {
			logger.Error("Error listing upgrade metadata", "error", err)
			return err
		}

		//
		for _, item := range resp.GetItems() {
			upgrade := item.(*upgradesv0alpha1.UpgradeMetadata)
			if upgrade.Spec.State == "new" {
				if err := v.client.Delete(ctx, upgrade.GetStaticMetadata().Identifier(), resource.DeleteOptions{}); err != nil {
					logger.Error("Error deleting upgrade metadata", "error", err)
				}
			}
		}

		if resp.GetContinue() == "" {
			break
		}
		continueToken = resp.GetContinue()
	}

	logger.Info("Starting version cron")
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	checkVersionsFunc := func(ctx context.Context) {
		upgrades, err := v.GetLatestVersions(ctx)
		if err != nil {
			logger.Error("Error getting latest versions", "error", err)
			return
		}

		logger.Info("Inserting new upgrade metadata", "count", len(upgrades))
		for _, upgrade := range upgrades {
			_, err := v.client.Create(ctx, upgrade.GetStaticMetadata().Identifier(), upgrade, resource.CreateOptions{})
			if err != nil {
				logger.Error("Error creating upgrade metadata", "error", err)
			}
		}
	}

	checkVersionsFunc(ctx)
	for {
		select {
		case <-ticker.C:
			checkVersionsFunc(ctx)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

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

// Might come in handy later
// func (v *VersionChecker) Resolution() string {
// 	return "Your Grafana instance is running on version " + s.GrafanaVersion + " which is out-of-date.\n" +
// 		"It is recommended to keep your Grafana instance up to date to ensure you have the latest security patches, bug fixes and features. " +
// 		"<a href='https://grafana.com/docs/grafana/latest/upgrade-guide/when-to-upgrade/#what-to-know-about-version-support' target='_blank'>" +
// 		"Learn more about version support</a>."
// }

func (v *VersionChecker) GetLatestVersions(ctx context.Context) ([]*upgradesv0alpha1.UpgradeMetadata, error) {
	currentVersion, err := semver.NewVersion(v.currentVersion)
	if err != nil {
		v.log.Error("Unable to parse the version", "version", v.currentVersion, "error", err)
		return nil, nil
	}

	releases, err := v.fetchVersionsFromGrafanaAPI(ctx, currentVersion)
	if err != nil {
		var gerr error
		releases, gerr = v.fetchVersionsFromGitHub(ctx, currentVersion)
		if gerr != nil {
			v.log.Error("Unable to fetch the Grafana versions", "github_error", err, "website_error", gerr)
			return nil, nil
		}

		v.log.Warn("Unable to fetch the Grafana versions from GitHub, falling back to Grafana website", "error", err)
	}

	versionInfo := v.parseVersionInfo(ctx, *currentVersion, slices.Collect(maps.Keys(releases)))

	latestVersions := make([]*upgradesv0alpha1.UpgradeMetadata, 0)
	uniqueReportedVersions := make(map[string]struct{})

	isCurrentVersionOutOfSupport := !v.isVersionSupported(*currentVersion, releases)

	// Report failures for all newer major versions
	for _, latestVersionForMajor := range versionInfo.latestMajorVersions {
		versionString := latestVersionForMajor.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[latestVersionForMajor].releaseDate

			isTargetVersionOutOfSupport := !v.isVersionSupported(latestVersionForMajor, releases)

			latestVersions = append(
				latestVersions,
				&upgradesv0alpha1.UpgradeMetadata{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("upgrade-from-%s-to-%s", currentVersion.String(), versionString),
						Namespace: "default",
						Labels: map[string]string{
							"currentVersionOutOfSupport": strconv.FormatBool(isCurrentVersionOutOfSupport),
						},
					},
					Spec: upgradesv0alpha1.UpgradeMetadataSpec{
						StartingVersion:        currentVersion.String(),
						TargetVersion:          versionString,
						State:                  "new",
						IsOutOfSupport:         isTargetVersionOutOfSupport,
						TargetMinorReleaseDate: releaseDate.Format(time.DateOnly),
					},
				},
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report minor version updates
	if versionInfo.latestMinor.Minor() > currentVersion.Minor() {
		versionString := versionInfo.latestMinor.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestMinor].releaseDate
			isTargetVersionOutOfSupport := !v.isVersionSupported(versionInfo.latestMinor, releases)

			latestVersions = append(
				latestVersions,
				&upgradesv0alpha1.UpgradeMetadata{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("upgrade-from-%s-to-%s", currentVersion.String(), versionString),
						Namespace: "default",
						Labels: map[string]string{
							"currentVersionOutOfSupport": strconv.FormatBool(isCurrentVersionOutOfSupport),
						},
					},
					Spec: upgradesv0alpha1.UpgradeMetadataSpec{
						StartingVersion:        currentVersion.String(),
						TargetVersion:          versionString,
						State:                  "new",
						IsOutOfSupport:         isTargetVersionOutOfSupport,
						TargetMinorReleaseDate: releaseDate.Format(time.DateOnly),
					},
				},
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report patch version updates
	if versionInfo.latestPatch.Patch() > currentVersion.Patch() {
		versionString := versionInfo.latestPatch.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestPatch].releaseDate
			isTargetVersionOutOfSupport := !v.isVersionSupported(versionInfo.latestPatch, releases)

			latestVersions = append(
				latestVersions,
				&upgradesv0alpha1.UpgradeMetadata{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("upgrade-from-%s-to-%s", currentVersion.String(), versionString),
						Namespace: "default",
						Labels: map[string]string{
							"currentVersionOutOfSupport": strconv.FormatBool(isCurrentVersionOutOfSupport),
						},
					},
					Spec: upgradesv0alpha1.UpgradeMetadataSpec{
						StartingVersion:        currentVersion.String(),
						TargetVersion:          versionString,
						State:                  "new",
						IsOutOfSupport:         isTargetVersionOutOfSupport,
						TargetMinorReleaseDate: releaseDate.Format(time.DateOnly),
					},
				},
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	// Report security patch updates
	if versionInfo.latestSecurityPatch.Patch() == currentVersion.Patch() && versionInfo.latestSecurityPatch.Metadata() != currentVersion.Metadata() {
		versionString := versionInfo.latestSecurityPatch.String()

		if _, ok := uniqueReportedVersions[versionString]; !ok {
			releaseDate := releases[versionInfo.latestSecurityPatch].releaseDate
			isTargetVersionOutOfSupport := !v.isVersionSupported(versionInfo.latestSecurityPatch, releases)

			latestVersions = append(
				latestVersions,
				&upgradesv0alpha1.UpgradeMetadata{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("upgrade-from-%s-to-%s", currentVersion.String(), versionString),
						Namespace: "default",
						Labels: map[string]string{
							"currentVersionOutOfSupport": strconv.FormatBool(isCurrentVersionOutOfSupport),
						},
					},
					Spec: upgradesv0alpha1.UpgradeMetadataSpec{
						StartingVersion:        currentVersion.String(),
						TargetVersion:          versionString,
						State:                  "new",
						IsOutOfSupport:         isTargetVersionOutOfSupport,
						TargetMinorReleaseDate: releaseDate.Format(time.DateOnly),
					},
				},
			)

			uniqueReportedVersions[versionString] = struct{}{}
		}
	}

	if len(latestVersions) == 0 {
		return nil, nil
	}

	return latestVersions, nil
}

// parseVersionInfo parses the version info from the releases and returns the recommended versions to upgrade to.
// It looks for the latest security patch for your current version, the latest patch for your minor version, and the latest patch for each supported major version above your current major version.
// The method does not take care of deduplication of the same upgrade paths.
// TODO: We need to check when the v0 patch for the latest minor was released, and determine if that is out of support.
func (v *VersionChecker) parseVersionInfo(ctx context.Context, currentVersion semver.Version, releases []semver.Version) *versionInfo {
	log := v.log.WithContext(ctx)
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

// fetchVersionsFromGrafanaAPI fetches the stable versions from the public API and returns all of the versions newer than the current Grafana version
func (v *VersionChecker) fetchVersionsFromGrafanaAPI(ctx context.Context, currentVersion *semver.Version) (map[semver.Version]*releaseDetails, error) {
	const product = "grafana"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://grafana.com/api/"+product+"/versions", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch versions: %w", err)
	}

	defer func() { _ = res.Body.Close() }()

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

		releaseDate, err := getReleaseDateForPatch(apiResponse, *version)
		if err != nil {
			return nil, fmt.Errorf("error getting release date for patch version %s: %w", version.String(), err)
		}

		releases[*version] = &releaseDetails{
			releaseDate:  releaseDate,
			releaseNotes: releaseVersion.WhatsNewURL,
		}
	}

	return releases, nil
}

func getReleaseDateForPatch(rawVersions grafanaAPIResponse, patchVersion semver.Version) (time.Time, error) {
	// Figure out which minor version this patch belongs to.
	minorVersion := fmt.Sprintf("%d.%d.0", patchVersion.Major(), patchVersion.Minor())

	for _, releaseVersion := range rawVersions.Versions {
		if releaseVersion.Version == minorVersion {
			return time.Parse(time.RFC3339, releaseVersion.ReleaseDate)
		}
	}
	return time.Time{}, fmt.Errorf("release date not found for patch version %s", patchVersion.String())
}

func (v *VersionChecker) findLatestMajor(releases map[semver.Version]*releaseDetails) uint64 {
	latestMajor := uint64(0)
	for version := range releases {
		if version.Major() > latestMajor {
			latestMajor = version.Major()
		}
	}
	return latestMajor
}

func (v *VersionChecker) findLatestMinorForMajor(major uint64, releases map[semver.Version]*releaseDetails) uint64 {
	latestMinor := uint64(0)
	for version := range releases {
		if version.Major() == major && version.Minor() > latestMinor {
			latestMinor = version.Minor()
		}
	}
	return latestMinor
}

func (v *VersionChecker) isVersionSupported(version semver.Version, releases map[semver.Version]*releaseDetails) bool {
	releaseDetails, ok := releases[version]
	if !ok {
		return false
	}

	latestOverallMajor := v.findLatestMajor(releases)

	// Only support versions from the latest major and the previous major (N-1)
	if version.Major() < latestOverallMajor-1 {
		return false
	}

	if version.Major() == latestOverallMajor-1 {
		latestMinorForMajor := v.findLatestMinorForMajor(version.Major(), releases)

		// Latest minor of previous major gets 15 months support
		if version.Minor() == latestMinorForMajor {
			return time.Now().Before(releaseDetails.releaseDate.AddDate(0, 15, 0))
		}
	}

	// All other versions get 9 months of support
	return time.Now().Before(releaseDetails.releaseDate.AddDate(0, 9, 0))
}

// fetchVersionsFromGitHub is a backup method for fetching the versions from the Grafana API. It is unauthenticated and prone to rate limiting.
// The what's new URL is not included.
func (v *VersionChecker) fetchVersionsFromGitHub(ctx context.Context, currentVersion *semver.Version) (map[semver.Version]*releaseDetails, error) {
	releases := make(map[semver.Version]*releaseDetails, 0)

	for page := 1; ; page++ {
		ghReleases, _, err := v.ghClient.ListReleases(ctx, "grafana", "grafana", &github.ListOptions{
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
				releaseDate:  release.GetPublishedAt().UTC(),
				releaseNotes: release.GetHTMLURL(),
			}
		}
	}

	return releases, nil
}
