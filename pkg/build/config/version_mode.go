package config

// VersionMode defines the source event that created a release or published version
type VersionMode string

const (
	MainMode          VersionMode = "main"
	ReleaseMode       VersionMode = "release"
	BetaReleaseMode   VersionMode = "beta"
	TestReleaseMode   VersionMode = "test"
	ReleaseBranchMode VersionMode = "branch"
	PullRequestMode   VersionMode = "pull_request"
)
