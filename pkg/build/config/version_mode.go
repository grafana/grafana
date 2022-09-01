package config

// VersionMode defines the source event that created a release or published version
type VersionMode string

const (
	MainMode          VersionMode = "main"
	TagMode           VersionMode = "release"
	ReleaseBranchMode VersionMode = "branch"
	PullRequestMode   VersionMode = "pull_request"
	CustomMode        VersionMode = "custom"
)

const (
	Tag         = "tag"
	PullRequest = "pull_request"
	Push        = "push"
	Custom      = "custom"
	Promote     = "promote"
)

const (
	MainBranch = "main"
)
