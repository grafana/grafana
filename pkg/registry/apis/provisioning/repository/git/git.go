package git

import "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"

// GitRepository is an interface that combines all repository capabilities
// needed for Git repositories.
//
//go:generate mockery --name GitRepository --structname MockGitRepository --inpackage --filename git_repository_mock.go --with-expecter
type GitRepository interface {
	repository.Repository
	repository.Versioned
	repository.Writer
	repository.Reader
	repository.StageableRepository
	repository.Hooks
	URL() string
	Branch() string
}
