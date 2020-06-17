package main

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPreparingReleaseFromRemote(t *testing.T) {

	cases := []struct {
		version         string
		expectedVersion string
		whatsNewURL     string
		relNotesURL     string
		nightly         bool
		expectedBeta    bool
		expectedStable  bool
		expectedArch    string
		expectedOs      string
		expectedURL     string
		baseArchiveURL  string
		buildArtifacts  []buildArtifact
	}{
		{
			version:         "v5.2.0-beta1",
			expectedVersion: "5.2.0-beta1",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         false,
			expectedBeta:    true,
			expectedStable:  false,
			expectedArch:    "amd64",
			expectedOs:      "linux",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.2.0-beta1.linux-amd64.tar.gz",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"linux", "amd64", ".linux-amd64.tar.gz", ""}},
		},
		{
			version:         "v5.2.3",
			expectedVersion: "5.2.3",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         false,
			expectedBeta:    false,
			expectedStable:  true,
			expectedArch:    "amd64",
			expectedOs:      "rhel",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.2.3-1.x86_64.rpm",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"rhel", "amd64", ".x86_64.rpm", ""}},
		},
		{
			version:         "v5.4.0-pre1asdf",
			expectedVersion: "5.4.0-pre1asdf",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         true,
			expectedBeta:    false,
			expectedStable:  false,
			expectedArch:    "amd64",
			expectedOs:      "rhel",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.4.0~pre1asdf-1.x86_64.rpm",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"rhel", "amd64", ".x86_64.rpm", ""}},
		},
		{
			version:         "v5.4.0-pre1asdf",
			expectedVersion: "5.4.0-pre1asdf",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         true,
			expectedBeta:    false,
			expectedStable:  false,
			expectedArch:    "armv6",
			expectedOs:      "deb",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-rpi_5.4.0~pre1asdf_armhf.deb",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts: []buildArtifact{
				{os: "deb", arch: "armv6", urlPostfix: "_armhf.deb", packagePostfix: "-rpi"},
			},
		},
		{
			version:         "v5.4.0-pre1asdf",
			expectedVersion: "5.4.0-pre1asdf",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         true,
			expectedBeta:    false,
			expectedStable:  false,
			expectedArch:    "amd64",
			expectedOs:      "win-installer",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.4.0-pre1asdf.windows-amd64.msi",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"win-installer", "amd64", ".windows-amd64.msi", ""}},
		},
		{
			version:         "v5.4.0-pre1asdf",
			expectedVersion: "5.4.0-pre1asdf",
			whatsNewURL:     "https://whatsnews.foo/",
			relNotesURL:     "https://relnotes.foo/",
			nightly:         true,
			expectedBeta:    false,
			expectedStable:  false,
			expectedArch:    "amd64",
			expectedOs:      "win",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.4.0-pre1asdf.windows-amd64.zip",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"win", "amd64", ".windows-amd64.zip", ""}},
		},
	}

	for _, test := range cases {
		builder := releaseFromExternalContent{
			getter:                 mockHTTPGetter{},
			rawVersion:             test.version,
			artifactConfigurations: test.buildArtifacts,
		}

		t.Log("Preparing release", "baseArchiveURL", test.baseArchiveURL, "nightly", test.nightly)
		rel, err := builder.prepareRelease(test.baseArchiveURL, test.whatsNewURL, test.relNotesURL, test.nightly)
		require.NoError(t, err)

		assert.Equal(t, test.expectedBeta, rel.Beta)
		assert.Equal(t, test.expectedStable, rel.Stable)
		assert.Equal(t, test.expectedVersion, rel.Version)

		assert.Len(t, rel.Builds, len(test.buildArtifacts))

		build := rel.Builds[0]
		assert.Equal(t, test.expectedArch, build.Arch)
		assert.Equal(t, test.expectedOs, build.Os)
		assert.Equal(t, test.expectedURL, build.URL)
	}
}

type mockHTTPGetter struct{}

func (mockHTTPGetter) getContents(url string) (string, error) {
	return url, nil
}

func TestFilterBuildArtifacts(t *testing.T) {
	buildArtifacts, _ := filterBuildArtifacts(completeBuildArtifactConfigurations, Add, []artifactFilter{
		{os: "deb", arch: "amd64"},
		{os: "rhel", arch: "amd64"},
		{os: "linux", arch: "amd64"},
		{os: "win", arch: "amd64"},
	})

	if len(buildArtifacts) != 4 {
		t.Errorf("Expected 4 build artifacts after filtering, but was %v", len(buildArtifacts))
	}

	buildArtifacts, err := filterBuildArtifacts([]buildArtifact{
		{
			os:   "linux",
			arch: "amd64",
		},
		{
			os:   "arm",
			arch: "amd64",
		},
		{
			os:   "darwin",
			arch: "amd64",
		},
	}, Remove, []artifactFilter{
		{os: "darwin", arch: "amd64"},
	})

	if err != nil {
		t.Error()
	}

	if len(buildArtifacts) != 2 {
		t.Errorf("Expected 2 artifacts, was %v", len(buildArtifacts))
	}

	for _, ba := range buildArtifacts {
		if ba.arch == "amd64" && ba.os == "darwin" {
			t.Errorf("darwin/amd64 should be gone due to filtering")
		}
	}

	left := []buildArtifact{
		{
			os:   "linux",
			arch: "amd64",
		},
		{
			os:   "arm",
			arch: "amd64",
		},
	}

	if !reflect.DeepEqual(left, buildArtifacts) {
		t.Errorf("Lists should have been equal but was, expected=%v, actual=%v", left, buildArtifacts)
	}
}
