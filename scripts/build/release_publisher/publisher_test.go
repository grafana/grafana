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
			buildArtifacts:  []buildArtifact{{"linux", "amd64", ".linux-amd64.tar.gz"}},
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
			buildArtifacts:  []buildArtifact{{"rhel", "amd64", ".x86_64.rpm"}},
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
			buildArtifacts:  []buildArtifact{{"rhel", "amd64", ".x86_64.rpm"}},
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

func TestPreparingReleaseFromLocal(t *testing.T) {
	whatsNewURL := "https://whatsnews.foo/"
	relNotesURL := "https://relnotes.foo/"
	expectedVersion := "5.4.0-123pre1"
	expectedBuilds := 4

	var builder releaseBuilder
	testDataPath := "testdata"
	builder = releaseLocalSources{
		path:                   testDataPath,
		artifactConfigurations: completeBuildArtifactConfigurations,
	}

	relAll, _ := builder.prepareRelease("https://s3-us-west-2.amazonaws.com/grafana-enterprise-releases/master/grafana-enterprise", whatsNewURL, relNotesURL, true)

	if relAll.Stable || !relAll.Nightly {
		t.Error("Expected a nightly release but wasn't.")
	}

	if relAll.ReleaseNotesURL != relNotesURL {
		t.Errorf("expected releaseNotesURL to be %s, but it was %s", relNotesURL, relAll.ReleaseNotesURL)
	}
	if relAll.WhatsNewURL != whatsNewURL {
		t.Errorf("expected whatsNewURL to be %s, but it was %s", whatsNewURL, relAll.WhatsNewURL)
	}

	if relAll.Beta {
		t.Errorf("Expected release to be nightly, not beta.")
	}

	if relAll.Version != expectedVersion {
		t.Errorf("Expected version=%s, but got=%s", expectedVersion, relAll.Version)
	}

	if len(relAll.Builds) != expectedBuilds {
		t.Errorf("Expected %v builds, but was %v", expectedBuilds, len(relAll.Builds))
	}

	expectedArch := "amd64"
	expectedOs := "win"

	builder = releaseLocalSources{
		path: testDataPath,
		artifactConfigurations: []buildArtifact{{
			os:         expectedOs,
			arch:       expectedArch,
			urlPostfix: ".windows-amd64.zip",
		}},
	}

	relOne, _ := builder.prepareRelease("https://s3-us-west-2.amazonaws.com/grafana-enterprise-releases/master/grafana-enterprise", whatsNewURL, relNotesURL, true)

	if len(relOne.Builds) != 1 {
		t.Errorf("Expected 1 artifact, but was %v", len(relOne.Builds))
	}

	build := relOne.Builds[0]

	if build.Arch != expectedArch {
		t.Fatalf("Expected arch to be %s, but was %s", expectedArch, build.Arch)
	}

	if build.Os != expectedOs {
		t.Fatalf("Expected os to be %s, but was %s", expectedOs, build.Os)
	}

	_, err := builder.prepareRelease("", "", "", false)
	if err == nil {
		t.Error("Error was nil, but expected an error as the local releaser only supports nightly builds.")
	}
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
