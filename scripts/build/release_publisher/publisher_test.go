package main

import "testing"

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
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-5.4.0-pre1asdf.x86_64.rpm",
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
			expectedOs:      "linux",
			expectedURL:     "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-rpi-5.4.0-pre1asdf_armhf.deb",
			baseArchiveURL:  "https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana",
			buildArtifacts:  []buildArtifact{{"linux", "armv6", "_armhf.deb", "-rpi"}},
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

		rel, _ := builder.prepareRelease(test.baseArchiveURL, test.whatsNewURL, test.relNotesURL, test.nightly)

		if rel.Beta != test.expectedBeta || rel.Stable != test.expectedStable {
			t.Errorf("%s should have been tagged as beta=%v, stable=%v.", test.version, test.expectedBeta, test.expectedStable)
		}

		if rel.Version != test.expectedVersion {
			t.Errorf("Expected version to be %s, but it was %s.", test.expectedVersion, rel.Version)
		}

		expectedBuilds := len(test.buildArtifacts)
		if len(rel.Builds) != expectedBuilds {
			t.Errorf("Expected %v builds, but got %v.", expectedBuilds, len(rel.Builds))
		}

		build := rel.Builds[0]
		if build.Arch != test.expectedArch {
			t.Errorf("Expected arch to be %v, but it was %v", test.expectedArch, build.Arch)
		}

		if build.Os != test.expectedOs {
			t.Errorf("Expected os to be %v, but it was %v", test.expectedOs, build.Os)
		}

		if build.URL != test.expectedURL {
			t.Errorf("Expected url to be %v, but it was %v", test.expectedURL, build.URL)
		}
	}
}

type mockHTTPGetter struct{}

func (mockHTTPGetter) getContents(url string) (string, error) {
	return url, nil
}

func TestFilterBuildArtifacts(t *testing.T) {
	buildArtifacts, _ := filterBuildArtifacts([]artifactFilter{
		{os: "deb", arch: "amd64"},
		{os: "rhel", arch: "amd64"},
		{os: "linux", arch: "amd64"},
		{os: "win", arch: "amd64"},
	})

	if len(buildArtifacts) != 4 {
		t.Errorf("Expected 4 build artifacts after filtering, but was %v", len(buildArtifacts))
	}

	_, err := filterBuildArtifacts([]artifactFilter{
		{os: "foobar", arch: "amd64"},
	})

	if err == nil {
		t.Errorf("Expected an error as a we tried to filter on a nonexiststant os.")
	}

}
