package validation

import (
	"context"
)

type ArtifactType int

const (
	ArtifactTypeDockerHub ArtifactType = iota
	ArtifactTypeGCSObject
)

type Artifact struct {
	Type ArtifactType
	URL  string
}

// ReleaseArtifacts generates a list of release artifacts
func ReleaseArtifacts(version string) ([]Artifact, error) {
	return nil, nil
}

// VerifyRelease tests that a that, given the information, a release will completed wholly and successfully.
func VerifyRelease(ctx context.Context, version string) (bool, error) {
	return false, nil
}
