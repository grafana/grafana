package config

// VersionMode defines the source event that created a release or published version
type VersionMode string

const (
	MainMode          VersionMode = "main"
	TagMode           VersionMode = "release"
	ReleaseBranchMode VersionMode = "branch"
	PullRequestMode   VersionMode = "pull_request"
	DownstreamMode    VersionMode = "downstream"
	Enterprise2Mode   VersionMode = "enterprise2"
	CronjobMode       VersionMode = "cron"
	CloudMode         VersionMode = "cloud"
)

const (
	Tag         = "tag"
	PullRequest = "pull_request"
	Push        = "push"
	Custom      = "custom"
	Promote     = "promote"
	Cronjob     = "cron"
)

const (
	MainBranch = "main"
)
