// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CommitOptions struct {
	// Template for commit messages produced by single-resource UI operations
	// (dashboard save/delete/move, folder create/rename/delete).
	// Bulk operations and sync jobs are out of scope and build their own messages.
	// Supports variables: {{action}}, {{resourceKind}}, {{resourceID}}, {{title}},
	// {{userName}}, {{userLogin}}, {{userEmail}}.
	// When empty, a built-in default is used (e.g. "Save dashboard: <title>").
	SingleResourceMessageTemplate string `json:"singleResourceMessageTemplate,omitempty"`
	// When true, the Comment field in Save drawers is pre-filled from
	// SingleResourceMessageTemplate and rendered read-only.
	EnforceTemplate bool `json:"enforceTemplate,omitempty"`
	// Name used as the commit author instead of the user who triggered the
	// commit. Only valid when signingMethod is unset.
	AuthorName string `json:"authorName,omitempty"`
	// Email used as the commit author instead of the user who triggered the
	// commit. Only valid when signingMethod is unset.
	AuthorEmail string `json:"authorEmail,omitempty"`
	// Name used as the commit signer. Required for the signing key's identity
	// to match the commit, which providers need to mark commits as Verified. When
	// empty, defaults to "Grafana".
	SignerName string `json:"signerName,omitempty"`
	// Email used as the commit signer. Must match the signing key's identity
	// and a verified email on the account where the matching public key is
	// registered. When empty, defaults to "noreply@grafana.com".
	SignerEmail string `json:"signerEmail,omitempty"`
	// Method used to sign commits with the key in secure.commitSigningKey. One of "gpg", "ssh", or "smime".
	// When empty, commits are not signed.
	SigningMethod SigningMethod `json:"signingMethod,omitempty"`
	// When true, commits are authored by the signer identity
	// (signerName/signerEmail).
	SignerIsAuthor bool `json:"signerIsAuthor,omitempty"`
	// PEM-encoded X.509 certificate paired with secure.commitSigningKey when
	// signingMethod is "smime". This is public (not a secret) and is embedded
	// in the commit signature. Unused for the gpg and ssh formats.
	SMIMECertificate string `json:"smimeCertificate,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for CommitOptions.
func (CommitOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.CommitOptions"
}

// +k8s:openapi-gen=true
type BranchOptions struct {
	// Template for the branch name created in branch workflow.
	// Supports variables: {{action}}, {{resourceKind}}, {{title}},
	// {{userLogin}}, {{random}}.
	// {{random}} is a 6-character alphanumeric token generated at render
	// time to avoid collisions. The result is sanitised to a valid git ref
	// (lowercase, alphanumeric + dashes, max 100 chars).
	// When empty, the current auto-generated name is preserved.
	NameTemplate string `json:"nameTemplate,omitempty"`
	// When true, the branch name field in Save drawers is read-only.
	EnforceTemplate bool `json:"enforceTemplate,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for BranchOptions.
func (BranchOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.BranchOptions"
}

// +k8s:openapi-gen=true
type PullRequestOptions struct {
	// Template for pull request titles.
	// Supports the same variables as BranchOptions.NameTemplate
	// ({{random}} is available but rarely useful here).
	// When empty, the first line of the commit message is used.
	TitleTemplate string `json:"titleTemplate,omitempty"`
	// When true, the PR title field in Save drawers is read-only.
	EnforceTemplate bool `json:"enforceTemplate,omitempty"`
	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for PullRequestOptions.
func (PullRequestOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.PullRequestOptions"
}

// +k8s:openapi-gen=true
type SyncOptions struct {
	// Enabled must be saved as true before any sync job will run
	Enabled bool `json:"enabled"`
	// Where values should be saved
	Target SyncTargetType `json:"target"`
	// The interval between sync runs.
	// The system defines a default value for this field, which will overwrite the
	// user-defined one in case the latter is zero or lower than the system-defined one.
	IntervalSeconds int64 `json:"intervalSeconds,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for SyncOptions.
func (SyncOptions) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.SyncOptions"
}

// +k8s:openapi-gen=true
type WebhookConfig struct {
	// Base URL of the Grafana instance used to construct the webhook endpoint
	// registered with the external Git provider. Only the base URL should be
	// provided (e.g. `https://grafana.example.com`); the API path, namespace,
	// and resource name are appended automatically. Trailing slashes are stripped.
	// Must be a valid HTTP or HTTPS URL.
	BaseURL string `json:"baseUrl,omitempty"`
	// Disabled turns off webhook integration for this repository. When true,
	// Grafana will not register or receive webhook events from the Git provider
	// and will poll the repository on an interval instead. Use this when Grafana
	// is not reachable from the public internet.
	Disabled bool `json:"disabled,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for WebhookConfig.
func (WebhookConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.WebhookConfig"
}

// +k8s:openapi-gen=true
type LocalRepositoryConfig struct {
	Path string `json:"path,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for LocalRepositoryConfig.
func (LocalRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.LocalRepositoryConfig"
}

// +k8s:openapi-gen=true
type GitHubRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	// TODO: deprecate this field in favor of PullRequestOptions.GenerateDashboardPreviews once all Github repositories have been backfilled.
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for GitHubRepositoryConfig.
func (GitHubRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitHubRepositoryConfig"
}

// GitHubEnterpriseRepositoryConfig describes a repository hosted on a self-managed
// GitHub Enterprise Server (GHES) instance.
// +k8s:openapi-gen=true
type GitHubEnterpriseRepositoryConfig struct {
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerURL string `json:"serverUrl,omitempty"`
	// The repository URL on the GHES server (e.g. `https://ghes.example.com/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Path is the subdirectory for the Grafana data inside the repository.
	Path string `json:"path,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for GitHubEnterpriseRepositoryConfig.
func (GitHubEnterpriseRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitHubEnterpriseRepositoryConfig"
}

// +k8s:openapi-gen=true
type GitRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser string `json:"tokenUser,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for GitRepositoryConfig.
func (GitRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitRepositoryConfig"
}

// +k8s:openapi-gen=true
type BitbucketRepositoryConfig struct {
	// The repository URL (e.g. `https://bitbucket.org/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser string `json:"tokenUser,omitempty"`
	// Email is the Atlassian account email used to authenticate the Bitbucket REST API. Required to enable webhooks.
	Email string `json:"email,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for BitbucketRepositoryConfig.
func (BitbucketRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.BitbucketRepositoryConfig"
}

// +k8s:openapi-gen=true
type GitLabRepositoryConfig struct {
	// The repository URL (e.g. `https://gitlab.com/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
	// RepoID is the GitLab project's immutable numeric ID. Resolved and set
	// automatically whenever URL is set or changed; it survives a project
	// transfer/move even if the project's path changes. Read-only: it is
	// always system-derived and never taken from client-supplied input.
	RepoID string `json:"repoID,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for GitLabRepositoryConfig.
func (GitLabRepositoryConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitLabRepositoryConfig"
}

// +k8s:openapi-gen=true
type ConnectionInfo struct {
	Name string `json:"name"`
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionInfo.
func (ConnectionInfo) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionInfo"
}

// +k8s:openapi-gen=true
type RepositorySpec struct {
	// The repository display name (shown in the UI)
	Title string `json:"title"`
	// Repository description
	Description string `json:"description,omitempty"`
	// Commit message options. Currently only contains the template used by
	// single-resource UI operations; future siblings (bulk, sync) can live here.
	Commit *CommitOptions `json:"commit,omitempty"`
	// Branch naming options. Only meaningful when Workflows includes "branch".
	Branch *BranchOptions `json:"branch,omitempty"`
	// Pull request options. Only meaningful when Workflows includes "branch".
	PullRequest *PullRequestOptions `json:"pullRequest,omitempty"`
	// UI driven Workflow that allow changes to the contends of the repository.
	// The order is relevant for defining the precedence of the workflows.
	// When empty, the repository does not support any edits (eg, readonly)
	// +listType=atomic
	Workflows []Workflow `json:"workflows"`
	// Sync settings -- how values are pulled from the repository into grafana
	Sync SyncOptions `json:"sync"`
	// The repository type.  When selected oneOf the values below should be non-nil
	Type RepositoryType `json:"type"`
	// Webhook settings for the repository.
	// When specified, the base URL overrides the auto-detected Grafana public URL
	// used to register webhooks with the external Git provider.
	Webhook *WebhookConfig `json:"webhook,omitempty"`
	// The repository on the local file system.
	// Mutually exclusive with local | github.
	Local *LocalRepositoryConfig `json:"local,omitempty"`
	// The repository on GitHub.
	// Mutually exclusive with local | github | git.
	GitHub *GitHubRepositoryConfig `json:"github,omitempty"`
	// The repository on a self-managed GitHub Enterprise Server (GHES).
	// Mutually exclusive with local | github | git.
	GitHubEnterprise *GitHubEnterpriseRepositoryConfig `json:"githubEnterprise,omitempty"`
	// The repository on Git.
	// Mutually exclusive with local | github | git.
	Git *GitRepositoryConfig `json:"git,omitempty"`
	// The repository on Bitbucket.
	// Mutually exclusive with local | github | git.
	Bitbucket *BitbucketRepositoryConfig `json:"bitbucket,omitempty"`
	// The repository on GitLab.
	// Mutually exclusive with local | github | git.
	GitLab *GitLabRepositoryConfig `json:"gitlab,omitempty"`
	// The connection the repository references.
	// This means the Repository is interacting with git via a Connection.
	Connection *ConnectionInfo `json:"connection,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for RepositorySpec.
func (RepositorySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositorySpec"
}
