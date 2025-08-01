// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RepositorySyncOptions struct {
	// Enabled must be saved as true before any sync job will run
	Enabled bool `json:"enabled"`
	// Where values should be saved
	Target RepositorySyncOptionsTarget `json:"target"`
	// When non-zero, the sync will run periodically
	IntervalSeconds *int64 `json:"intervalSeconds,omitempty"`
}

// NewRepositorySyncOptions creates a new RepositorySyncOptions object.
func NewRepositorySyncOptions() *RepositorySyncOptions {
	return &RepositorySyncOptions{}
}

// +k8s:openapi-gen=true
type RepositoryLocalRepositoryConfig struct {
	// Path to the local repository
	Path string `json:"path"`
}

// NewRepositoryLocalRepositoryConfig creates a new RepositoryLocalRepositoryConfig object.
func NewRepositoryLocalRepositoryConfig() *RepositoryLocalRepositoryConfig {
	return &RepositoryLocalRepositoryConfig{}
}

// +k8s:openapi-gen=true
type RepositoryGitHubRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
	Token *string `json:"token,omitempty"`
	// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
	EncryptedToken []string `json:"encryptedToken,omitempty"`
	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	GenerateDashboardPreviews *bool `json:"generateDashboardPreviews,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitHubRepositoryConfig creates a new RepositoryGitHubRepositoryConfig object.
func NewRepositoryGitHubRepositoryConfig() *RepositoryGitHubRepositoryConfig {
	return &RepositoryGitHubRepositoryConfig{}
}

// +k8s:openapi-gen=true
type RepositoryGitRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test.git`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser *string `json:"tokenUser,omitempty"`
	// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
	Token *string `json:"token,omitempty"`
	// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
	EncryptedToken []string `json:"encryptedToken,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitRepositoryConfig creates a new RepositoryGitRepositoryConfig object.
func NewRepositoryGitRepositoryConfig() *RepositoryGitRepositoryConfig {
	return &RepositoryGitRepositoryConfig{}
}

// +k8s:openapi-gen=true
type RepositoryBitbucketRepositoryConfig struct {
	// The repository URL (e.g. `https://bitbucket.org/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser *string `json:"tokenUser,omitempty"`
	// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
	Token *string `json:"token,omitempty"`
	// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
	EncryptedToken []string `json:"encryptedToken,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryBitbucketRepositoryConfig creates a new RepositoryBitbucketRepositoryConfig object.
func NewRepositoryBitbucketRepositoryConfig() *RepositoryBitbucketRepositoryConfig {
	return &RepositoryBitbucketRepositoryConfig{}
}

// +k8s:openapi-gen=true
type RepositoryGitLabRepositoryConfig struct {
	// The repository URL (e.g. `https://gitlab.com/example/test`).
	Url *string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
	Token *string `json:"token,omitempty"`
	// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
	EncryptedToken []string `json:"encryptedToken,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	Path *string `json:"path,omitempty"`
}

// NewRepositoryGitLabRepositoryConfig creates a new RepositoryGitLabRepositoryConfig object.
func NewRepositoryGitLabRepositoryConfig() *RepositoryGitLabRepositoryConfig {
	return &RepositoryGitLabRepositoryConfig{}
}

// +k8s:openapi-gen=true
type RepositorySpec struct {
	// The repository display name (shown in the UI)
	Title string `json:"title"`
	// Repository description
	Description *string `json:"description,omitempty"`
	// UI driven Workflow that allow changes to the contends of the repository.
	// The order is relevant for defining the precedence of the workflows.
	// When empty, the repository does not support any edits (eg, readonly)
	Workflows []string `json:"workflows,omitempty"`
	// Sync settings -- how values are pulled from the repository into grafana
	Sync RepositorySyncOptions `json:"sync"`
	// The repository type. When selected oneOf the values below should be non-nil
	Type RepositorySpecType `json:"type"`
	// The repository on the local file system.
	// Mutually exclusive with local | github.
	Local *RepositoryLocalRepositoryConfig `json:"local,omitempty"`
	// The repository on GitHub.
	// Mutually exclusive with local | github | git.
	Github *RepositoryGitHubRepositoryConfig `json:"github,omitempty"`
	// The repository on Git.
	// Mutually exclusive with local | github | git.
	Git *RepositoryGitRepositoryConfig `json:"git,omitempty"`
	// The repository on Bitbucket.
	// Mutually exclusive with local | github | git.
	Bitbucket *RepositoryBitbucketRepositoryConfig `json:"bitbucket,omitempty"`
	// The repository on GitLab.
	// Mutually exclusive with local | github | git.
	Gitlab *RepositoryGitLabRepositoryConfig `json:"gitlab,omitempty"`
}

// NewRepositorySpec creates a new RepositorySpec object.
func NewRepositorySpec() *RepositorySpec {
	return &RepositorySpec{
		Sync: *NewRepositorySyncOptions(),
	}
}

// +k8s:openapi-gen=true
type RepositorySyncOptionsTarget string

const (
	RepositorySyncOptionsTargetUnified RepositorySyncOptionsTarget = "unified"
	RepositorySyncOptionsTargetLegacy  RepositorySyncOptionsTarget = "legacy"
)

// +k8s:openapi-gen=true
type RepositorySpecType string

const (
	RepositorySpecTypeLocal     RepositorySpecType = "local"
	RepositorySpecTypeGithub    RepositorySpecType = "github"
	RepositorySpecTypeGit       RepositorySpecType = "git"
	RepositorySpecTypeBitbucket RepositorySpecType = "bitbucket"
	RepositorySpecTypeGitlab    RepositorySpecType = "gitlab"
)
