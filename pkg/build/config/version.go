package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/build/git"
)

type Metadata struct {
	GrafanaVersion string      `json:"version,omitempty"`
	ReleaseMode    ReleaseMode `json:"releaseMode,omitempty"`
	GrabplVersion  string      `json:"grabplVersion,omitempty"`
	CurrentCommit  string      `json:"currentCommit,omitempty"`
}

type ReleaseMode struct {
	Mode   VersionMode `json:"mode,omitempty"`
	IsBeta bool        `json:"isBeta,omitempty"`
	IsTest bool        `json:"isTest,omitempty"`
}

type PluginSignature struct {
	Sign      bool `json:"sign,omitempty"`
	AdminSign bool `json:"adminSign,omitempty"`
}

type Docker struct {
	ShouldSave       bool           `json:"shouldSave,omitempty"`
	Distribution     []Distribution `json:"distribution,omitempty"`
	Architectures    []Architecture `json:"archs,omitempty"`
	PrereleaseBucket string         `json:"prereleaseBucket,omitempty"`
}

type Buckets struct {
	Artifacts            string `json:"artifacts,omitempty"`
	ArtifactsEnterprise2 string `json:"artifactsEnterprise2,omitempty"`
	CDNAssets            string `json:"CDNAssets,omitempty"`
	CDNAssetsDir         string `json:"CDNAssetsDir,omitempty"`
	Storybook            string `json:"storybook,omitempty"`
	StorybookSrcDir      string `json:"storybookSrcDir,omitempty"`
}

// BuildConfig represents the struct that defines all of the different variables used to build Grafana
type BuildConfig struct {
	Variants        []Variant       `json:"variants,omitempty"`
	PluginSignature PluginSignature `json:"pluginSignature,omitempty"`
	Docker          Docker          `json:"docker,omitempty"`
	Buckets         Buckets         `json:"buckets,omitempty"`
}

func (md *Metadata) GetReleaseMode() (ReleaseMode, error) {
	return md.ReleaseMode, nil
}

// VersionMap is a map of versions. Each key of the Versions map is an event that uses the the config as the value for that key.
// For example, the 'pull_request' key will have data in it that might cause Grafana to be built differently in a pull request,
// than the way it will be built in 'main'
type VersionMap map[VersionMode]BuildConfig

// GetBuildConfig reads the embedded config.json and decodes it.
func GetBuildConfig(mode VersionMode) (*BuildConfig, error) {
	if v, ok := Versions[mode]; ok {
		return &v, nil
	}

	return nil, fmt.Errorf("mode '%s' not found in version list", mode)
}

// GetGrafanaVersion gets the Grafana version from the package.json
func GetGrafanaVersion(buildID, grafanaDir string) (string, error) {
	pkgJSONPath := filepath.Join(grafanaDir, "package.json")
	//nolint:gosec
	pkgJSONB, err := os.ReadFile(pkgJSONPath)
	if err != nil {
		return "", fmt.Errorf("failed to read %q: %w", pkgJSONPath, err)
	}
	pkgObj := map[string]interface{}{}
	if err := json.Unmarshal(pkgJSONB, &pkgObj); err != nil {
		return "", fmt.Errorf("failed decoding %q: %w", pkgJSONPath, err)
	}

	version := pkgObj["version"].(string)
	if version == "" {
		return "", fmt.Errorf("failed to read version from %q", pkgJSONPath)
	}
	if buildID != "" {
		buildID = shortenBuildID(buildID)
		verComponents := strings.Split(version, "-")
		version = verComponents[0]
		if len(verComponents) > 1 {
			buildID = fmt.Sprintf("%s%s", buildID, verComponents[1])
		}
		version = fmt.Sprintf("%s-%s", version, buildID)
	}

	return version, nil
}

func CheckDroneTargetBranch() (VersionMode, error) {
	rePRCheckBranch := git.PRCheckRegexp()
	reRlsBranch := regexp.MustCompile(`^v\d+\.\d+\.x$`)
	target := os.Getenv("DRONE_TARGET_BRANCH")
	if target == "" {
		return "", fmt.Errorf("failed to get DRONE_TARGET_BRANCH environmental variable")
	} else if target == string(MainMode) {
		return MainMode, nil
	}
	if reRlsBranch.MatchString(target) {
		return ReleaseBranchMode, nil
	}
	if rePRCheckBranch.MatchString(target) {
		return PullRequestMode, nil
	}
	fmt.Printf("unrecognized target branch: %s, defaulting to %s", target, PullRequestMode)
	return PullRequestMode, nil
}

func CheckSemverSuffix() (ReleaseMode, error) {
	reBetaRls := regexp.MustCompile(`beta.*`)
	reTestRls := regexp.MustCompile(`test.*`)
	tagSuffix, ok := os.LookupEnv("DRONE_SEMVER_PRERELEASE")
	if !ok || tagSuffix == "" {
		fmt.Println("DRONE_SEMVER_PRERELEASE doesn't exist for a tag, this is a release event...")
		return ReleaseMode{Mode: TagMode}, nil
	}
	switch {
	case reBetaRls.MatchString(tagSuffix):
		return ReleaseMode{Mode: TagMode, IsBeta: true}, nil
	case reTestRls.MatchString(tagSuffix):
		return ReleaseMode{Mode: TagMode, IsTest: true}, nil
	default:
		fmt.Printf("DRONE_SEMVER_PRERELEASE is custom string, release event with %s suffix\n", tagSuffix)
		return ReleaseMode{Mode: TagMode}, nil
	}
}

func GetDroneCommit() (string, error) {
	commit := strings.TrimSpace(os.Getenv("DRONE_COMMIT"))
	if commit == "" {
		return "", fmt.Errorf("the environment variable DRONE_COMMIT is missing")
	}
	return commit, nil
}

func shortenBuildID(buildID string) string {
	buildID = strings.ReplaceAll(buildID, "-", "")
	if len(buildID) < 9 {
		return buildID
	}

	return buildID[0:8]
}
