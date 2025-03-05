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
	// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
	Token string `json:"token,omitempty"`
	// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
	// +listType=atomic
	EncryptedToken []byte `json:"encryptedToken,omitempty"`

	// Whether we should show dashboard previews for pull requests.
	// By default, this is false (i.e. we will not create previews).
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`
}

// RepositoryType defines the types of Repository
// +enum
type RepositoryType string

// RepositoryType values
const (
	LocalRepositoryType  RepositoryType = "local"
	GitHubRepositoryType RepositoryType = "github"
)

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
	// Mutually exclusive with local | github.
	// TODO: github or just 'git'??
	GitHub *GitHubRepositoryConfig `json:"github,omitempty"`
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
	// The folder k8s name will be the same as the repository k8s name
	// It will contain a copy of everything from the remote
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

	// Summary messages (will be shown to users)
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
	Secret           string   `json:"secret,omitempty"`
	EncryptedSecret  []byte   `json:"encryptedSecret,omitempty"`
	SubscribedEvents []string `json:"subscribedEvents,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []Repository `json:"items,omitempty"`
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
	// +listType=atomic
	Lint []LintIssue `json:"lint,omitempty"`

	// If errors exist, show them here
	// +listType=atomic
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

	// +listType=atomic
	Items []FileItem `json:"items,omitempty"`
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
	Items []ResourceListItem `json:"items,omitempty"`
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

	// +listType=atomic
	Items []ResourceCount `json:"items,omitempty"`
}

type ResourceCount struct {
	Repository string `json:"repository,omitempty"`
	Group      string `json:"group"`
	Resource   string `json:"resource"`
	Count      int64  `json:"count"`
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

	// +listType=atomic
	Items []HistoryItem `json:"items,omitempty"`
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
