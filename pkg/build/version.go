package build

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type PackageJSON struct {
	Version string `json:"version"`
}

// Opens the package.json file in the provided directory and returns a struct that represents its contents
func OpenPackageJSON(dir string) (PackageJSON, error) {
	reader, err := os.Open(filepath.Clean(dir + "/package.json"))
	if err != nil {
		return PackageJSON{}, err
	}

	defer logAndClose(reader)

	jsonObj := PackageJSON{}
	if err := json.NewDecoder(reader).Decode(&jsonObj); err != nil {
		return PackageJSON{}, err
	}

	return jsonObj, nil
}

// LinuxPackageVersion extracts the linux package version and iteration out of the version string. The version string is likely extracted from the package JSON.
func LinuxPackageVersion(v string, buildID string) (string, string) {
	var (
		version   = v
		iteration = ""
	)

	// handle pre version stuff (deb / rpm does not support semver)
	parts := strings.Split(v, "-")

	if len(parts) > 1 {
		version = parts[0]
		iteration = parts[1]
	}

	if buildID == "" {
		return version, iteration
	}

	// add timestamp to iteration
	if buildID != "0" {
		iteration = strings.Join([]string{buildID, iteration}, "")
		return version, iteration
	}

	return version, fmt.Sprintf("%d%s", time.Now().Unix(), iteration)
}

func shortenBuildID(buildID string) string {
	buildID = strings.ReplaceAll(buildID, "-", "")
	if len(buildID) < 9 {
		return buildID
	}
	return buildID[0:8]
}
