package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// When this code is changed, make sure to update the code generation.
// As of writing, this can be done via the hack dir in the root of the repo: ./hack/update-codegen.sh provisioning
// If you've opened the generated files in this dir at some point in VSCode, you may also have to re-open them to clear errors.
// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Repository struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   RepositorySpec   `json:"spec,omitempty"`
	Status RepositoryStatus `json:"status,omitempty"`
}

type LocalRepositoryConfig struct {
	Path string `json:"path,omitempty"`
}

type S3RepositoryConfig struct {
	Region string `json:"region,omitempty"`
	Bucket string `json:"bucket,omitempty"`

	// TODO: Add ACL?
	// TODO: Encryption??
	// TODO: How do we define access? Secrets?
}

type GitHubRepositoryConfig struct {
	// The owner of the repository (e.g. example in `example/test` or `https://github.com/example/test`).
	Owner string `json:"owner,omitempty"`
	// The name of the repository (e.g. test in `example/test` or `https://github.com/example/test`).
	Repository string `json:"repository,omitempty"`
	// The branch to use in the repository.
	// By default, this is the main branch.
	Branch string `json:"branch,omitempty"`
	// Token for accessing the repository.
	// TODO: this should be part of secrets and a simple reference.
	Token string `json:"token,omitempty"`
	// TODO: Do we want an SSH url instead maybe?
	// TODO: On-prem GitHub Enterprise support?

	// Whether we should commit to change branches and use a Pull Request flow to achieve this.
	// By default, this is false (i.e. we will commit straight to the main branch).
	BranchWorkflow bool `json:"branchWorkflow,omitempty"`

	// Whether we should show dashboard previews in the pull requests caused by the BranchWorkflow option.
	// By default, this is false (i.e. we will not create previews).
	// This option is a no-op if BranchWorkflow is `false` or default.
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`

	// PullRequestLinter enables the dashboard linter for this repository in Pull Requests
	PullRequestLinter bool `json:"pullRequestLinter,omitempty"`
}

// RepositoryType defines the types of Repository
// +enum
type RepositoryType string

// RepositoryType values
const (
	LocalRepositoryType  RepositoryType = "local"
	S3RepositoryType     RepositoryType = "s3"
	GitHubRepositoryType RepositoryType = "github"
)

type RepositorySpec struct {
	// Describe the feature toggle
	Title string `json:"title"`

	// Describe the feature toggle
	Description string `json:"description,omitempty"`

	// The folder that is backed by the repository.
	// The value is a reference to the Kubernetes metadata name of the folder in the same namespace.
	Folder string `json:"folder,omitempty"`

	// Should we prefer emitting YAML for this repository, e.g. upon export?
	// Editing existing dashboards will continue to emit the file format used in the repository. (TODO: implement this)
	// If you delete and then recreate a dashboard, it will switch to the preferred format.
	PreferYAML bool `json:"preferYaml,omitempty"`

	// Edit options within the repository
	Editing EditingOptions `json:"editing"`

	// The repository type.  When selected oneOf the values below should be non-nil
	Type RepositoryType `json:"type"`

	// Linting enables linting for this repository
	Linting bool `json:"linting,omitempty"`

	// The repository on the local file system.
	// Mutually exclusive with s3 and github.
	Local *LocalRepositoryConfig `json:"local,omitempty"`

	// The repository in an S3 bucket.
	// Mutually exclusive with local and github.
	S3 *S3RepositoryConfig `json:"s3,omitempty"`

	// The repository on GitHub.
	// Mutually exclusive with local and s3.
	// TODO: github or just 'git'??
	GitHub *GitHubRepositoryConfig `json:"github,omitempty"`
}

type EditingOptions struct {
	// End users can create new files in the remote file system
	Create bool `json:"create"`
	// End users can update existing files in the remote file system
	Update bool `json:"update"`
	// End users can delete existing files in the remote file system
	Delete bool `json:"delete"`
}

// The status of a Repository.
// This is expected never to be created by a kubectl call or similar, and is expected to rarely (if ever) be edited manually.
// As such, it is also a little less well structured than the spec, such as conditional-but-ever-present fields.
type RepositoryStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`

	// This will get updated with the current health status (and updated periodically)
	Health HealthStatus `json:"health"`

	// Sync information with the last sync information
	Sync SyncStatus `json:"sync"`

	// Webhook Information (if applicable)
	Webhook *WebhookStatus `json:"webhook"`
}

type HealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`

	// When the health was checked last time
	Checked int64 `json:"checked,omitempty"`

	// Summary messages (will be shown to users)
	Message []string `json:"message,omitempty"`
}

type SyncStatus struct {
	// pending, running, success, error
	State JobState `json:"state"`

	// The ID for the job that ran this sync
	JobID string `json:"job,omitempty"`

	// When the sync job started
	Started int64 `json:"started,omitempty"`

	// When the sync job finished
	Finished int64 `json:"finished,omitempty"`

	// When the next sync check is scheduled
	Scheduled int64 `json:"scheduled,omitempty"`

	// Summary messages (will be shown to users)
	Message []string `json:"message,omitempty"`

	// The repository hash when the last sync ran
	Hash string `json:"hash,omitempty"`
}

type WebhookStatus struct {
	ID               int64    `json:"id,omitempty"`
	URL              string   `json:"url,omitempty"`
	Secret           string   `json:"secret,omitempty"`
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Repository `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HelloWorld struct {
	metav1.TypeMeta `json:",inline"`

	Whom string `json:"whom,omitempty"`
}

// The kubernetes action required when loading a given resource
// +enum
type ResourceAction string

// ResourceAction values
const (
	ResourceActionCreate ResourceAction = "create"
	ResourceActionUpdate ResourceAction = "update"
	ResourceActionDelete ResourceAction = "delete"
)

// This is a container type for any resource type
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ResourceWrapper struct {
	metav1.TypeMeta `json:",inline"`

	// Path to the remote file
	Path string `json:"path,omitempty"`

	// The commit hash (if exists)
	Ref string `json:"ref,omitempty"`

	// The repo hash value
	Hash string `json:"hash,omitempty"`

	// The modified time in the remote file system
	Timestamp *metav1.Time `json:"timestamp,omitempty"`

	// Different flavors of the same object
	Resource ResourceObjects `json:"resource"`

	// Lint results
	Lint []LintIssue `json:"lint,omitempty"`

	// If errors exist, show them here
	Errors []string `json:"errors,omitempty"`
}

// The kubernetes action required when loading a given resource
// +enum
type LintSeverity string

// ResourceAction values
const (
	LintSeverityExclude LintSeverity = "exclude"
	LintSeverityQuiet   LintSeverity = "quiet"
	LintSeverityWarning LintSeverity = "warning"
	LintSeverityError   LintSeverity = "error"
	LintSeverityFixed   LintSeverity = "fixed"
)

type LintIssue struct {
	Severity LintSeverity `json:"severity"`
	Rule     string       `json:"rule"`
	Message  string       `json:"message"`
}

type ResourceType struct {
	Group    string `json:"group,omitempty"`
	Version  string `json:"version,omitempty"`
	Kind     string `json:"kind,omitempty"`
	Resource string `json:"resource,omitempty"`

	// For non-k8s native formats, what did this start as
	Classic ClassicFileType `json:"classic,omitempty"`
}

type ResourceObjects struct {
	// The identified type for this object
	Type ResourceType `json:"type"`

	// The resource from the repository with all modifications applied
	// eg, the name, folder etc will all be applied to this object
	File common.Unstructured `json:"file,omitempty"`

	// The same value, currently saved in the grafana database
	Existing common.Unstructured `json:"existing,omitempty"`

	// The action required/used for dryRun
	Action ResourceAction `json:"action,omitempty"`

	// The value returned from a dryRun request
	DryRun common.Unstructured `json:"dryRun,omitempty"`
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// should be named "items", but avoid subresource error for now:
	// kubernetes/kubernetes#126809
	Items []FileItem `json:"files,omitempty"`
}

type FileItem struct {
	Path     string `json:"path"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	Modified int64  `json:"modified,omitempty"`
	Author   string `json:"author,omitempty"`
}

// HistoryList is a list of versions of a resource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TestResults struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP status code
	Code int `json:"code"`

	// Is the connection healthy
	Success bool `json:"success"`

	// Error descriptions
	Errors []string `json:"errors,omitempty"`

	// Optional details
	Details *common.Unstructured `json:"details,omitempty"`
}

// HistoryList is a list of versions of a resource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HistoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// should be named "items", but avoid subresource error for now:
	// kubernetes/kubernetes#126809
	Items []HistoryItem `json:"items,omitempty"`
}

type Author struct {
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarURL,omitempty"`
}

type HistoryItem struct {
	Ref       string   `json:"ref"`
	Message   string   `json:"message"`
	Authors   []Author `json:"authors"`
	CreatedAt int64    `json:"createdAt"`
}
