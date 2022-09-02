package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
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
	ShouldSave    bool           `json:"shouldSave,omitempty"`
	Architectures []Architecture `json:"archs,omitempty"`
}

// Version represents the "version.json" that defines all of the different variables used to build Grafana
type Version struct {
	Variants                  []Variant       `json:"variants,omitempty"`
	PluginSignature           PluginSignature `json:"pluginSignature,omitempty"`
	Docker                    Docker          `json:"docker,omitempty"`
	PackagesBucket            string          `json:"packagesBucket,omitempty"`
	PackagesBucketEnterprise2 string          `json:"packagesBucketEnterprise2,omitempty"`
	CDNAssetsBucket           string          `json:"CDNAssetsBucket,omitempty"`
	CDNAssetsDir              string          `json:"CDNAssetsDir,omitempty"`
	StorybookBucket           string          `json:"storybookBucket,omitempty"`
	StorybookSrcDir           string          `json:"storybookSrcDir,omitempty"`
}

func (md *Metadata) GetReleaseMode() (ReleaseMode, error) {
	return md.ReleaseMode, nil
}

// Versions is a map of versions. Each key of the Versions map is an event that uses the the config as the value for that key.
// For example, the 'pull_request' key will have data in it that might cause Grafana to be built differently in a pull request,
// than the way it will be built in 'main'
type VersionMap map[VersionMode]Version

// GetMetadata attempts to read the JSON file located at 'path' and decode it as a Metadata{} type.
// If the provided path does not exist, then an error is not returned. Instead, an empty metadata is returned with no error.
func GetMetadata(path string) (*Metadata, error) {
	if _, err := os.Stat(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &Metadata{}, nil
		}
		return nil, err
	}
	// Ignore gosec G304 as this function is only used in the build process.
	//nolint:gosec
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := file.Close(); err != nil {
			log.Printf("error closing file at '%s': %s", path, err.Error())
		}
	}()

	return DecodeMetadata(file)
}

// DecodeMetadata decodes the data in the io.Reader 'r' as Metadata.
func DecodeMetadata(r io.Reader) (*Metadata, error) {
	m := &Metadata{}
	if err := json.NewDecoder(r).Decode(m); err != nil {
		return nil, err
	}

	return m, nil
}

// GetVersions reads the embedded config.json and decodes it.
func GetVersion(mode VersionMode) (*Version, error) {
	if v, ok := Versions[mode]; ok {
		return &v, nil
	}

	return nil, fmt.Errorf("mode '%s' not found in version list", mode)
}

func shortenBuildID(buildID string) string {
	buildID = strings.ReplaceAll(buildID, "-", "")
	if len(buildID) < 9 {
		return buildID
	}

	return buildID[0:8]
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
	return "", fmt.Errorf("unrecognized target branch: %s", target)
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
