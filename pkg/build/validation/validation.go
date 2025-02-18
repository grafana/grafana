package validation

type ArtifactType int

const (
	ArtifactTypeDockerHub ArtifactType = iota
	ArtifactTypeGCSObject
)

type Artifact struct {
	Type ArtifactType
	URL  string
}
