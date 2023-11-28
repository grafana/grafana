package versions

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"

	"github.com/Masterminds/semver/v3"
)

var (
	reGrafanaTag        = regexp.MustCompile(`^v(\d+\.\d+\.\d+$)`)
	reGrafanaTagPreview = regexp.MustCompile(`^v(\d+\.\d+\.\d+-preview)`)
	reGrafanaTagCustom  = regexp.MustCompile(`^v(\d+\.\d+\.\d+-\w+)`)
)

const (
	Latest = "latest"
	Next   = "next"
	Test   = "test"
)

type Version struct {
	Version string
	Channel string
}

type VersionFromAPI struct {
	Version string `json:"version"`
}

type LatestGcomAPI = string

const (
	LatestStableVersionURL LatestGcomAPI = "https://grafana.com/api/grafana/versions/stable"
	LatestBetaVersionURL   LatestGcomAPI = "https://grafana.com/api/grafana/versions/beta"
)

func GetLatestVersion(url LatestGcomAPI) (string, error) {
	// nolint:gosec
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Printf("Failed to close body: %s", err.Error())
		}
	}()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("server returned non 200 status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var apiResponse VersionFromAPI
	err = json.Unmarshal(body, &apiResponse)
	if err != nil {
		return "", err
	}

	return apiResponse.Version, nil
}

// IsGreaterThanOrEqual semantically checks whether newVersion is greater than or equal to stableVersion.
func IsGreaterThanOrEqual(newVersion, stableVersion string) (bool, error) {
	v1SemVer, err := semver.NewVersion(newVersion)
	if err != nil {
		return isGreaterThanOrEqualFourDigit(newVersion, stableVersion)
	}

	v2SemVer, err := semver.NewVersion(stableVersion)
	if err != nil {
		return isGreaterThanOrEqualFourDigit(newVersion, stableVersion)
	}

	comp := v1SemVer.Compare(v2SemVer)
	switch comp {
	case -1:
		return false, nil
	case 1, 0:
		return true, nil
	default:
		return true, fmt.Errorf("unknown comparison value between scemantic versions, err: %q", err)
	}
}

var fourDigitRe = regexp.MustCompile(`(\d+\.\d+\.\d+)\.(\d+)`)

func parseFourDigit(version string) (*semver.Version, int, error) {
	matches := fourDigitRe.FindStringSubmatch(version)
	if len(matches) < 2 {
		semVer, err := semver.NewVersion(version)
		if err != nil {
			return nil, 0, err
		}
		return semVer, 0, nil
	}
	semVer, err := semver.NewVersion(matches[1])
	if err != nil {
		return nil, 0, err
	}
	i, err := strconv.Atoi(matches[2])
	if err != nil {
		return nil, 0, err
	}

	return semVer, i, nil
}

func isGreaterThanOrEqualFourDigit(newVersion, stableVersion string) (bool, error) {
	newVersionSemVer, newVersionSemVerNo, err := parseFourDigit(newVersion)
	if err != nil {
		return false, err
	}

	stableVersionSemVer, stableVersionSemVerNo, err := parseFourDigit(stableVersion)
	if err != nil {
		return false, err
	}

	if stableVersionSemVer.Original() != newVersionSemVer.Original() {
		return IsGreaterThanOrEqual(newVersionSemVer.Original(), stableVersionSemVer.Original())
	}

	return newVersionSemVerNo >= stableVersionSemVerNo, nil
}

func GetVersion(tag string) (*Version, error) {
	var version Version
	switch {
	case reGrafanaTag.MatchString(tag):
		version = Version{
			Version: reGrafanaTag.FindStringSubmatch(tag)[1],
			Channel: Latest,
		}
	case reGrafanaTagPreview.MatchString(tag):
		version = Version{
			Version: reGrafanaTagPreview.FindStringSubmatch(tag)[1],
			Channel: Next,
		}
	case reGrafanaTagCustom.MatchString(tag):
		version = Version{
			Version: reGrafanaTagCustom.FindStringSubmatch(tag)[1],
			Channel: Test,
		}
	default:
		return nil, fmt.Errorf("%s not a supported Grafana version, exitting", tag)
	}

	return &version, nil
}
