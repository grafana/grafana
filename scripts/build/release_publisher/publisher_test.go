package main

import "testing"

func TestNewRelease(t *testing.T) {
	versionIn := "v5.2.0-beta1"
	expectedVersion := "5.2.0-beta1"
	whatsNewUrl := "https://whatsnews.foo/"
	relNotesUrl := "https://relnotes.foo/"
	expectedArch := "amd64"
	expectedOs := "linux"
	buildArtifacts := []buildArtifact{{expectedOs, expectedArch, ".linux-amd64.tar.gz"}}

	rel, _ := newRelease(versionIn, whatsNewUrl, relNotesUrl, buildArtifacts, mockHttpGetter{})

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
