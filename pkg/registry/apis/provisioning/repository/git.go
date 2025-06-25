package repository

// GitRepository is an interface that combines all repository capabilities
// needed for Git repositories.
//
//go:generate mockery --name GitRepository --structname MockGitRepository --inpackage --filename git_repository_mock.go --with-expecter
type GitRepository interface {
	Repository
	Versioned
	Writer
	Reader
	ClonableRepository
	URL() string
	Branch() string
}
