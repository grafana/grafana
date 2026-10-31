// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type RepositoryCommitOptions struct {
	// Template for commit messages produced by single-resource UI operations
	// (dashboard save/delete/move, folder create/rename/delete).
	// Bulk operations and sync jobs are out of scope and build their own messages.
	// Supports variables: {{action}}, {{resourceKind}}, {{resourceID}}, {{title}},
	// {{userName}}, {{userLogin}}, {{userEmail}}.
	// When empty, a built-in default is used (e.g. "Save dashboard: <title>").
	SingleResourceMessageTemplate *string `json:"singleResourceMessageTemplate,omitempty"`
	// When true, the Comment field in Save drawers is pre-filled from
	// SingleResourceMessageTemplate and rendered read-only.
	EnforceTemplate *bool `json:"enforceTemplate,omitempty"`
	// Name used as the commit author instead of the user who triggered the
	// commit. Only valid when signingMethod is unset.
	AuthorName *string `json:"authorName,omitempty"`
	// Email used as the commit author instead of the user who triggered the
	// commit. Only valid when signingMethod is unset.
	AuthorEmail *string `json:"authorEmail,omitempty"`
	// Name used as the commit signer. Required for the signing key's identity
	// to match the commit, which providers need to mark commits as Verified. When
	// empty, defaults to "Grafana".
	SignerName *string `json:"signerName,omitempty"`
	// Email used as the commit signer. Must match the signing key's identity
	// and a verified email on the account where the matching public key is
	// registered. When empty, defaults to "noreply@grafana.com".
	SignerEmail *string `json:"signerEmail,omitempty"`
	// Method used to sign commits with the key in secure.commitSigningKey. One of "gpg", "ssh", or "smime".
	// When empty, commits are not signed.
	SigningMethod *RepositoryCommitOptionsSigningMethod `json:"signingMethod,omitempty"`
	// When true, commits are authored by the signer identity
	// (signerName/signerEmail).
	SignerIsAuthor *bool `json:"signerIsAuthor,omitempty"`
	// PEM-encoded X.509 certificate paired with secure.commitSigningKey when
	// signingMethod is "smime". This is public (not a secret) and is embedded
	// in the commit signature. Unused for the gpg and ssh formats.
	SmimeCertificate *string `json:"smimeCertificate,omitempty"`
}

// NewRepositoryCommitOptions creates a new RepositoryCommitOptions object.
func NewRepositoryCommitOptions() *RepositoryCommitOptions {
	return &RepositoryCommitOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryCommitOptions.
func (RepositoryCommitOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryCommitOptions"
}

// +k8s:openapi-gen=true
type RepositoryBranchOptions struct {
	// Template for the branch name created in branch workflow.
	// Supports variables: {{action}}, {{resourceKind}}, {{title}},
	// {{userLogin}}, {{random}}.
	// {{random}} is a 6-character alphanumeric token generated at render
	// time to avoid collisions. The result is sanitised to a valid git ref
	// (lowercase, alphanumeric + dashes, max 100 chars).
	// When empty, the current auto-generated name is preserved.
	NameTemplate *string `json:"nameTemplate,omitempty"`
	// When true, the branch name field in Save drawers is read-only.
	EnforceTemplate *bool `json:"enforceTemplate,omitempty"`
}

// NewRepositoryBranchOptions creates a new RepositoryBranchOptions object.
func NewRepositoryBranchOptions() *RepositoryBranchOptions {
	return &RepositoryBranchOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryBranchOptions.
func (RepositoryBranchOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryBranchOptions"
}

// +k8s:openapi-gen=true
type RepositoryPullRequestOptions struct {
	// Template for pull request titles.
	// Supports the same variables as BranchOptions.NameTemplate
	// ({{random}} is available but rarely useful here).
	// When empty, the first line of the commit message is used.
	TitleTemplate *string `json:"titleTemplate,omitempty"`
	// When true, the PR title field in Save drawers is read-only.
	EnforceTemplate *bool `json:"enforceTemplate,omitempty"`
	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	GenerateDashboardPreviews *bool `json:"generateDashboardPreviews,omitempty"`
}

// NewRepositoryPullRequestOptions creates a new RepositoryPullRequestOptions object.
func NewRepositoryPullRequestOptions() *RepositoryPullRequestOptions {
	return &RepositoryPullRequestOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryPullRequestOptions.
func (RepositoryPullRequestOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryPullRequestOptions"
}

// +k8s:openapi-gen=true
type RepositorySyncOptions struct {
	// Enabled must be saved as true before any sync job will run
	Enabled bool `json:"enabled"`
	// Where values should be saved
	Target RepositorySyncOptionsTarget `json:"target"`
	// The interval between sync runs.
	// The system defines a default value for this field, which will overwrite the
	// user-defined one in case the latter is zero or lower than the system-defined one.
	IntervalSeconds *int64 `json:"intervalSeconds,omitempty"`
}

// NewRepositorySyncOptions creates a new RepositorySyncOptions object.
func NewRepositorySyncOptions() *RepositorySyncOptions {
	return &RepositorySyncOptions{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositorySyncOptions.
func (RepositorySyncOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySyncOptions"
}

// +k8s:openapi-gen=true
type RepositoryWebhookConfig struct {
	// Base URL of the Grafana instance used to construct the webhook endpoint
	// registered with the external Git provider. Only the base URL should be
	// provided (e.g. `https://grafana.example.com`); the API path, namespace,
	// and resource name are appended automatically. Trailing slashes are stripped.
	// Must be a valid HTTP or HTTPS URL.
	BaseUrl *string `json:"baseUrl,omitempty"`
	// Disabled turns off webhook integration for this repository. When true,
	// Grafana will not register or receive webhook events from the Git provider
	// and will poll the repository on an interval instead. Use this when Grafana
	// is not reachable from the public internet.
	Disabled *bool `json:"disabled,omitempty"`
}

// NewRepositoryWebhookConfig creates a new RepositoryWebhookConfig object.
func NewRepositoryWebhookConfig() *RepositoryWebhookConfig {
	return &RepositoryWebhookConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryWebhookConfig.
func (RepositoryWebhookConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryWebhookConfig"
}

// +k8s:openapi-gen=true
type RepositoryLocalRepositoryConfig struct {
	Path *string `json:"path,omitempty"`
}

// NewRepositoryLocalRepositoryConfig creates a new RepositoryLocalRepositoryConfig object.
func NewRepositoryLocalRepositoryConfig() *RepositoryLocalRepositoryConfig {
	return &RepositoryLocalRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryLocalRepositoryConfig.
func (RepositoryLocalRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryLocalRepositoryConfig"
}

// +k8s:openapi-gen=true
type RepositoryGitHubRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	// TODO: deprecate this field in favor of PullRequestOptions.GenerateDashboardPreviews once all Github repositories have been backfilled.
	GenerateDashboardPreviews *bool `json:"generateDashboardPreviews,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitHubRepositoryConfig creates a new RepositoryGitHubRepositoryConfig object.
func NewRepositoryGitHubRepositoryConfig() *RepositoryGitHubRepositoryConfig {
	return &RepositoryGitHubRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryGitHubRepositoryConfig.
func (RepositoryGitHubRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryGitHubRepositoryConfig"
}

// GitHubEnterpriseRepositoryConfig describes a repository hosted on a self-managed
// GitHub Enterprise Server (GHES) instance.
// +k8s:openapi-gen=true
type RepositoryGitHubEnterpriseRepositoryConfig struct {
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerUrl *string `json:"serverUrl,omitempty"`
	// The repository URL on the GHES server (e.g. `https://ghes.example.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Path is the subdirectory for the Grafana data inside the repository.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitHubEnterpriseRepositoryConfig creates a new RepositoryGitHubEnterpriseRepositoryConfig object.
func NewRepositoryGitHubEnterpriseRepositoryConfig() *RepositoryGitHubEnterpriseRepositoryConfig {
	return &RepositoryGitHubEnterpriseRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryGitHubEnterpriseRepositoryConfig.
func (RepositoryGitHubEnterpriseRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryGitHubEnterpriseRepositoryConfig"
}

// +k8s:openapi-gen=true
type RepositoryGitRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser *string `json:"tokenUser,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitRepositoryConfig creates a new RepositoryGitRepositoryConfig object.
func NewRepositoryGitRepositoryConfig() *RepositoryGitRepositoryConfig {
	return &RepositoryGitRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryGitRepositoryConfig.
func (RepositoryGitRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryGitRepositoryConfig"
}

// +k8s:openapi-gen=true
type RepositoryBitbucketRepositoryConfig struct {
	// The repository URL (e.g. `https://bitbucket.org/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser *string `json:"tokenUser,omitempty"`
	// Email is the Atlassian account email used to authenticate the Bitbucket REST API. Required to enable webhooks.
	Email *string `json:"email,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryBitbucketRepositoryConfig creates a new RepositoryBitbucketRepositoryConfig object.
func NewRepositoryBitbucketRepositoryConfig() *RepositoryBitbucketRepositoryConfig {
	return &RepositoryBitbucketRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryBitbucketRepositoryConfig.
func (RepositoryBitbucketRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryBitbucketRepositoryConfig"
}

// +k8s:openapi-gen=true
type RepositoryGitLabRepositoryConfig struct {
	// The repository URL (e.g. `https://gitlab.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path *string `json:"path,omitempty"`
	// RepoID is the GitLab project's immutable numeric ID. Resolved and set
	// automatically whenever URL is set or changed; it survives a project
	// transfer/move even if the project's path changes. Read-only: it is
	// always system-derived and never taken from client-supplied input.
	RepoID *string `json:"repoID,omitempty"`
}

// NewRepositoryGitLabRepositoryConfig creates a new RepositoryGitLabRepositoryConfig object.
func NewRepositoryGitLabRepositoryConfig() *RepositoryGitLabRepositoryConfig {
	return &RepositoryGitLabRepositoryConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryGitLabRepositoryConfig.
func (RepositoryGitLabRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryGitLabRepositoryConfig"
}

// +k8s:openapi-gen=true
type RepositoryConnectionInfo struct {
	Name string `json:"name"`
}

// NewRepositoryConnectionInfo creates a new RepositoryConnectionInfo object.
func NewRepositoryConnectionInfo() *RepositoryConnectionInfo {
	return &RepositoryConnectionInfo{}
}

// OpenAPIModelName returns the OpenAPI model name for RepositoryConnectionInfo.
func (RepositoryConnectionInfo) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryConnectionInfo"
}

// +k8s:openapi-gen=true
type RepositorySpec struct {
	// The repository display name (shown in the UI)
	Title string `json:"title"`
	// Repository description
	Description *string `json:"description,omitempty"`
	// Commit message options. Currently only contains the template used by
	// single-resource UI operations; future siblings (bulk, sync) can live here.
	Commit *RepositoryCommitOptions `json:"commit,omitempty"`
	// Branch naming options. Only meaningful when Workflows includes "branch".
	Branch *RepositoryBranchOptions `json:"branch,omitempty"`
	// Pull request options. Only meaningful when Workflows includes "branch".
	PullRequest *RepositoryPullRequestOptions `json:"pullRequest,omitempty"`
	// UI driven Workflow that allow changes to the contends of the repository.
	// The order is relevant for defining the precedence of the workflows.
	// When empty, the repository does not support any edits (eg, readonly)
	Workflows []RepositorySpecWorkflows `json:"workflows"`
	// Sync settings -- how values are pulled from the repository into grafana
	Sync RepositorySyncOptions `json:"sync"`
	// The repository type.  When selected oneOf the values below should be non-nil
	Type RepositorySpecType `json:"type"`
	// Webhook settings for the repository.
	// When specified, the base URL overrides the auto-detected Grafana public URL
	// used to register webhooks with the external Git provider.
	Webhook *RepositoryWebhookConfig `json:"webhook,omitempty"`
	// The repository on the local file system.
	// Mutually exclusive with local | github.
	Local *RepositoryLocalRepositoryConfig `json:"local,omitempty"`
	// The repository on GitHub.
	// Mutually exclusive with local | github | git.
	Github *RepositoryGitHubRepositoryConfig `json:"github,omitempty"`
	// The repository on a self-managed GitHub Enterprise Server (GHES).
	// Mutually exclusive with local | github | git.
	GithubEnterprise *RepositoryGitHubEnterpriseRepositoryConfig `json:"githubEnterprise,omitempty"`
	// The repository on Git.
	// Mutually exclusive with local | github | git.
	Git *RepositoryGitRepositoryConfig `json:"git,omitempty"`
	// The repository on Bitbucket.
	// Mutually exclusive with local | github | git.
	Bitbucket *RepositoryBitbucketRepositoryConfig `json:"bitbucket,omitempty"`
	// The repository on GitLab.
	// Mutually exclusive with local | github | git.
	Gitlab *RepositoryGitLabRepositoryConfig `json:"gitlab,omitempty"`
	// The connection the repository references.
	// This means the Repository is interacting with git via a Connection.
	Connection *RepositoryConnectionInfo `json:"connection,omitempty"`
}

// NewRepositorySpec creates a new RepositorySpec object.
func NewRepositorySpec() *RepositorySpec {
	return &RepositorySpec{
		Workflows: []RepositorySpecWorkflows{},
		Sync:      *NewRepositorySyncOptions(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for RepositorySpec.
func (RepositorySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpec"
}

// +k8s:openapi-gen=true
type RepositoryCommitOptionsSigningMethod string

const (
	RepositoryCommitOptionsSigningMethodGpg   RepositoryCommitOptionsSigningMethod = "gpg"
	RepositoryCommitOptionsSigningMethodSsh   RepositoryCommitOptionsSigningMethod = "ssh"
	RepositoryCommitOptionsSigningMethodSmime RepositoryCommitOptionsSigningMethod = "smime"
)

// OpenAPIModelName returns the OpenAPI model name for RepositoryCommitOptionsSigningMethod.
func (RepositoryCommitOptionsSigningMethod) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositoryCommitOptionsSigningMethod"
}

// +k8s:openapi-gen=true
type RepositorySyncOptionsTarget string

const (
	RepositorySyncOptionsTargetInstance   RepositorySyncOptionsTarget = "instance"
	RepositorySyncOptionsTargetFolder     RepositorySyncOptionsTarget = "folder"
	RepositorySyncOptionsTargetFolderless RepositorySyncOptionsTarget = "folderless"
)

// OpenAPIModelName returns the OpenAPI model name for RepositorySyncOptionsTarget.
func (RepositorySyncOptionsTarget) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySyncOptionsTarget"
}

// +k8s:openapi-gen=true
type RepositorySpecWorkflows string

const (
	RepositorySpecWorkflowsWrite  RepositorySpecWorkflows = "write"
	RepositorySpecWorkflowsBranch RepositorySpecWorkflows = "branch"
)

// OpenAPIModelName returns the OpenAPI model name for RepositorySpecWorkflows.
func (RepositorySpecWorkflows) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpecWorkflows"
}

// +k8s:openapi-gen=true
type RepositorySpecType string

const (
	RepositorySpecTypeLocal            RepositorySpecType = "local"
	RepositorySpecTypeGithub           RepositorySpecType = "github"
	RepositorySpecTypeGithubEnterprise RepositorySpecType = "githubEnterprise"
	RepositorySpecTypeGit              RepositorySpecType = "git"
	RepositorySpecTypeBitbucket        RepositorySpecType = "bitbucket"
	RepositorySpecTypeGitlab           RepositorySpecType = "gitlab"
)

// OpenAPIModelName returns the OpenAPI model name for RepositorySpecType.
func (RepositorySpecType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.RepositorySpecType"
}
