package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	Secure SecureValues     `json:"secure,omitzero,omitempty"`
	Status RepositoryStatus `json:"status,omitempty"`
}

type SecureValues struct {
	// Token used to connect the configured repository
	Token common.InlineSecureValue `json:"token,omitzero,omitempty"`

	// Some webhooks (including github) require a secret key value
	WebhookSecret common.InlineSecureValue `json:"webhookSecret,omitzero,omitempty"`
}

func (v SecureValues) IsZero() bool {
	return v.Token.IsZero() && v.WebhookSecret.IsZero()
}

type LocalRepositoryConfig struct {
	Path string `json:"path,omitempty"`
}

// Workflow used for changes in the repository.
// +enum
type Workflow string

const (
	// WriteWorkflow allows a user to write directly to the repository
	WriteWorkflow Workflow = "write"
	// BranchWorkflow creates a branch for changes
	BranchWorkflow Workflow = "branch"
)

type GitHubRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test`).
	URL string `json:"url,omitempty"`

	// The branch to use in the repository.
	Branch string `json:"branch"`

	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`

	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	//
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

type GitRepositoryConfig struct {
	// The repository URL (e.g. `https://github.com/example/test.git`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser string `json:"tokenUser,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	//
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

type BitbucketRepositoryConfig struct {
	// The repository URL (e.g. `https://bitbucket.org/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// TokenUser is the user that will be used to access the repository if it's a personal access token.
	TokenUser string `json:"tokenUser,omitempty"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	//
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

type GitLabRepositoryConfig struct {
	// The repository URL (e.g. `https://gitlab.com/example/test`).
	URL string `json:"url,omitempty"`
	// The branch to use in the repository.
	Branch string `json:"branch"`
	// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
	// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
	// The path is relative to the root of the repository, regardless of the leading slash.
	//
	// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
	Path string `json:"path,omitempty"`
}

// RepositoryType defines the types of Repository
// +enum
type RepositoryType string

// RepositoryType values
const (
	LocalRepositoryType     RepositoryType = "local"
	GitHubRepositoryType    RepositoryType = "github"
	GitRepositoryType       RepositoryType = "git"
	BitbucketRepositoryType RepositoryType = "bitbucket"
	GitLabRepositoryType    RepositoryType = "gitlab"
)

// IsGit returns true if the repository type is git or github
func (r RepositoryType) IsGit() bool {
	return r == GitRepositoryType || r == GitHubRepositoryType || r == BitbucketRepositoryType || r == GitLabRepositoryType
}

type RepositorySpec struct {
	// The repository display name (shown in the UI)
	Title string `json:"title"`

	// Repository description
	Description string `json:"description,omitempty"`

	// UI driven Workflow that allow changes to the contends of the repository.
	// The order is relevant for defining the precedence of the workflows.
	// When empty, the repository does not support any edits (eg, readonly)
	Workflows []Workflow `json:"workflows"`

	// Sync settings -- how values are pulled from the repository into grafana
	Sync SyncOptions `json:"sync"`

	// The repository type.  When selected oneOf the values below should be non-nil
	Type RepositoryType `json:"type"`

	// The repository on the local file system.
	// Mutually exclusive with local | github.
	Local *LocalRepositoryConfig `json:"local,omitempty"`

	// The repository on GitHub.
	// Mutually exclusive with local | github | git.
	GitHub *GitHubRepositoryConfig `json:"github,omitempty"`

	// The repository on Git.
	// Mutually exclusive with local | github | git.
	Git *GitRepositoryConfig `json:"git,omitempty"`

	// The repository on Bitbucket.
	// Mutually exclusive with local | github | git.
	Bitbucket *BitbucketRepositoryConfig `json:"bitbucket,omitempty"`

	// The repository on GitLab.
	// Mutually exclusive with local | github | git.
	GitLab *GitLabRepositoryConfig `json:"gitlab,omitempty"`
}

// SyncTargetType defines where we want all values to resolve
// +enum
type SyncTargetType string

// RepositoryType values
const (
	// Resources are saved in the global context
	// Only one repository may specify the `instance` target
	// When this exists, the UI will promote writing to the instance repo
	// rather than the grafana database (where possible)
	SyncTargetTypeInstance SyncTargetType = "instance"

	// Resources will be saved into a folder managed by this repository
	// It will contain a copy of everything from the remote
	// The folder k8s name will be the same as the repository k8s name
	SyncTargetTypeFolder SyncTargetType = "folder"
)

type SyncOptions struct {
	// Enabled must be saved as true before any sync job will run
	Enabled bool `json:"enabled"`

	// Where values should be saved
	Target SyncTargetType `json:"target"`

	// Shared folder target
	// The value is a reference to the Kubernetes metadata name of the folder in the same namespace
	// Folder string `json:"folder,omitempty"`

	// When non-zero, the sync will run periodically
	IntervalSeconds int64 `json:"intervalSeconds,omitempty"`
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

	// The object count when sync last ran
	// +listType=atomic
	Stats []ResourceCount `json:"stats,omitempty"`

	// Webhook Information (if applicable)
	Webhook *WebhookStatus `json:"webhook"`
}

type HealthStatus struct {
	// When not healthy, requests will not be executed
	Healthy bool `json:"healthy"`

	// When the health was checked last time
	Checked int64 `json:"checked,omitempty"`

	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	// +listType=atomic
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
	// +listType=atomic
	Message []string `json:"message"`

	// The repository ref when the last successful sync ran
	LastRef string `json:"lastRef,omitempty"`

	// Incremental synchronization for versioned repositories
	Incremental bool `json:"incremental,omitempty"`
}

type WebhookStatus struct {
	ID               int64    `json:"id,omitempty"`
	URL              string   `json:"url,omitempty"`
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
	LastEvent        int64    `json:"lastEvent,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []Repository `json:"items"`
}

// The kubernetes action required when loading a given resource
// +enum
type ResourceAction string

// ResourceAction values
const (
	ResourceActionCreate ResourceAction = "create"
	ResourceActionUpdate ResourceAction = "update"
	ResourceActionDelete ResourceAction = "delete"
	ResourceActionMove   ResourceAction = "move"
)

// This is a container type for any resource type
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ResourceWrapper struct {
	metav1.TypeMeta `json:",inline"`

	// Path to the remote file
	Path string `json:"path,omitempty"`

	// The request ref (or branch if exists)
	Ref string `json:"ref,omitempty"`

	// The repo hash value
	Hash string `json:"hash,omitempty"`

	// Basic repository info
	Repository ResourceRepositoryInfo `json:"repository"`

	// Typed links for this file (only supported by external systems, github etc)
	URLs *RepositoryURLs `json:"urls,omitempty"`

	// The modified time in the remote file system
	Timestamp *metav1.Time `json:"timestamp,omitempty"`

	// Different flavors of the same object
	Resource ResourceObjects `json:"resource"`

	// If errors exist, show them here
	// +listType=atomic
	Errors []string `json:"errors,omitempty"`
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

	// For write events, this will return the value that was added or updated
	Upsert common.Unstructured `json:"upsert,omitempty"`
}

type ResourceRepositoryInfo struct {
	// The repository type
	Type RepositoryType `json:"type"`

	// The display name for this repository
	Title string `json:"title"`

	// The namespace this belongs to
	Namespace string `json:"namespace"`

	// The name (identifier)
	Name string `json:"name"`
}

type RepositoryURLs struct {
	// A URL pointing to the repository this lives in
	RepositoryURL string `json:"repositoryURL,omitempty"`

	// A URL pointing to the file or ref in the repository
	SourceURL string `json:"sourceURL,omitempty"`

	// A URL that will create a new pull request for this branch
	NewPullRequestURL string `json:"newPullRequestURL,omitempty"`

	// Compare this version to the target branch
	CompareURL string `json:"compareURL,omitempty"`
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []FileItem `json:"items"`
}

type FileItem struct {
	Path     string `json:"path"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	Modified int64  `json:"modified,omitempty"`
	Author   string `json:"author,omitempty"`
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ResourceListItem `json:"items"`
}

type ResourceListItem struct {
	Path     string `json:"path"`
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Name     string `json:"name"` // the k8s identifier
	Hash     string `json:"hash"`
	Time     int64  `json:"time,omitempty"`

	Title  string `json:"title,omitempty"`
	Folder string `json:"folder,omitempty"`
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ResourceStats struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// Stats across all unified storage
	// When legacy storage is still used, this will offer a shim
	// +listType=atomic
	Instance []ResourceCount `json:"instance,omitempty"`

	// Stats across all unified storage
	// When legacy storage is still used, this will offer a shim
	// +listType=atomic
	Unmanaged []ResourceCount `json:"unmanaged,omitempty"`

	// Stats for each manager
	// +listType=atomic
	Managed []ManagerStats `json:"managed,omitempty"`
}

type ManagerStats struct {
	// Manager kind
	Kind utils.ManagerKind `json:"kind,omitempty"`

	// Manager identity
	Identity string `json:"id,omitempty"`

	// stats
	Stats []ResourceCount `json:"stats"`
}

type ResourceCount struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

// HistoryList is a list of versions of a resource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TestResults struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP status code
	Code int `json:"code"`

	// Is the connection healthy
	Success bool `json:"success"`

	// Field related errors
	Errors []ErrorDetails `json:"errors,omitempty"`
}

type ErrorDetails struct {
	Type   metav1.CauseType `json:"type"`
	Field  string           `json:"field,omitempty"`
	Detail string           `json:"detail,omitempty"`
}

// HistoryList is a list of versions of a resource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HistoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []HistoryItem `json:"items"`
}

type Author struct {
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarURL,omitempty"`
}

type HistoryItem struct {
	Ref     string `json:"ref"`
	Message string `json:"message"`
	// +listType=atomic
	Authors   []Author `json:"authors"`
	CreatedAt int64    `json:"createdAt"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RefList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []RefItem `json:"items"`
}

type RefItem struct {
	// The name of the reference (branch or tag)
	Name string `json:"name"`
	// The SHA hash of the commit this ref points to
	Hash string `json:"hash,omitempty"`
	// The URL to the reference (branch or tag)
	RefURL string `json:"refURL,omitempty"`
}
