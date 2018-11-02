package main

import "testing"

func TestPreparingReleaseFromRemote(t *testing.T) {
	versionIn := "v5.2.0-beta1"
	expectedVersion := "5.2.0-beta1"
	whatsNewUrl := "https://whatsnews.foo/"
	relNotesUrl := "https://relnotes.foo/"
	expectedArch := "amd64"
	expectedOs := "linux"
	buildArtifacts := []buildArtifact{{expectedOs,expectedArch, ".linux-amd64.tar.gz"}}

	var builder releaseBuilder

	builder = releaseFromExternalContent{
		getter:     mockHttpGetter{},
		rawVersion: versionIn,
	}

	rel, _ := builder.prepareRelease("https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana", whatsNewUrl, relNotesUrl, buildArtifacts)

	if !rel.Beta || rel.Stable {
		t.Errorf("%s should have been tagged as beta (not stable), but wasn't	.", versionIn)
	}

	if rel.Version != expectedVersion {
		t.Errorf("Expected version to be %s, but it was %s.", expectedVersion, rel.Version)
	}

	expectedBuilds := len(buildArtifacts)
	if len(rel.Builds) != expectedBuilds {
		t.Errorf("Expected %v builds, but got %v.", expectedBuilds, len(rel.Builds))
	}

	build := rel.Builds[0]
	if build.Arch != expectedArch {
		t.Errorf("Expected arch to be %v, but it was %v", expectedArch, build.Arch)
	}

	if build.Os != expectedOs {
		t.Errorf("Expected arch to be %v, but it was %v", expectedOs, build.Os)
	}
}

type mockHttpGetter struct{}

func (mockHttpGetter) getContents(url string) (string, error) {
	return url, nil
}


func TestPreparingReleaseFromLocal(t *testing.T) {
	whatsNewUrl := "https://whatsnews.foo/"
	relNotesUrl := "https://relnotes.foo/"
	expectedVersion := "5.4.0-123pre1"
	expectedBuilds := 4

	var builder releaseBuilder
	builder = releaseLocalSources{
		path: "local_test_data",
	}

	relAll, _ := builder.prepareRelease("https://s3-us-west-2.amazonaws.com/grafana-enterprise-releases/master/grafana-enterprise", whatsNewUrl, relNotesUrl, buildArtifactConfigurations)

	if relAll.Stable || !relAll.Nightly {
		t.Error("Expected a nightly release but wasn't.")
	}

	if relAll.ReleaseNotesUrl != relNotesUrl {
		t.Errorf("expected releaseNotesUrl to be %s, but it was %s", relNotesUrl, relAll.ReleaseNotesUrl)
	}
	if relAll.WhatsNewUrl != whatsNewUrl {
		t.Errorf("expected whatsNewUrl to be %s, but it was %s", whatsNewUrl, relAll.WhatsNewUrl)
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
	relOne, _ := builder.prepareRelease("https://s3-us-west-2.amazonaws.com/grafana-enterprise-releases/master/grafana-enterprise", whatsNewUrl, relNotesUrl, []buildArtifact{{
		os:         expectedOs,
		arch:       expectedArch,
		urlPostfix: ".windows-amd64.zip",
	}})

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
}
