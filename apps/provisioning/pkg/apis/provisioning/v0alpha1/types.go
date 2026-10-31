package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	openapicommon "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/resource"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const OpenAPIPrefix = "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1."

type SecureValues struct {
	// Token used to connect the configured repository
	Token common.InlineSecureValue `json:"token,omitzero,omitempty"`

	// Some webhooks (including github) require a secret key value
	WebhookSecret common.InlineSecureValue `json:"webhookSecret,omitzero,omitempty"`

	// Private key used to sign commits the repository writes back. The format
	// is selected by spec.commit.signingMethod. When unset, commits are
	// unsigned.
	CommitSigningKey common.InlineSecureValue `json:"commitSigningKey,omitzero,omitempty"`
}

func (SecureValues) OpenAPIModelName() string {
	return OpenAPIPrefix + "SecureValues"
}

func (v SecureValues) IsZero() bool {
	return v.Token.IsZero() && v.WebhookSecret.IsZero() && v.CommitSigningKey.IsZero()
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

// RepositoryType defines the types of Repository
// +enum
type RepositoryType string

func (RepositoryType) OpenAPIModelName() string {
	return OpenAPIPrefix + "RepositoryType"
}

func (r RepositoryType) String() string {
	return string(r)
}

// RepositoryType values
const (
	LocalRepositoryType            RepositoryType = "local"
	GitHubRepositoryType           RepositoryType = "github"
	GitHubEnterpriseRepositoryType RepositoryType = "githubEnterprise"
	GitRepositoryType              RepositoryType = "git"
	BitbucketRepositoryType        RepositoryType = "bitbucket"
	GitLabRepositoryType           RepositoryType = "gitlab"
)

// IsGit returns true if the repository type is git or github
func (r RepositoryType) IsGit() bool {
	return r == GitRepositoryType || r == GitHubRepositoryType || r == GitHubEnterpriseRepositoryType || r == BitbucketRepositoryType || r == GitLabRepositoryType
}

// GitHub || GitHubEnterprise
func (r RepositoryType) IsGitHub() bool {
	return r == GitHubRepositoryType || r == GitHubEnterpriseRepositoryType
}

// Branch returns the branch for git-based repositories
// or an empty string for local repositories
func (r *Repository) Branch() string {
	if !r.Spec.Type.IsGit() {
		return ""
	}

	switch r.Spec.Type {
	case GitHubRepositoryType:
		if r.Spec.GitHub != nil {
			return r.Spec.GitHub.Branch
		}
	case GitHubEnterpriseRepositoryType:
		if r.Spec.GitHubEnterprise != nil {
			return r.Spec.GitHubEnterprise.Branch
		}
	case GitRepositoryType:
		if r.Spec.Git != nil {
			return r.Spec.Git.Branch
		}
	case BitbucketRepositoryType:
		if r.Spec.Bitbucket != nil {
			return r.Spec.Bitbucket.Branch
		}
	case GitLabRepositoryType:
		if r.Spec.GitLab != nil {
			return r.Spec.GitLab.Branch
		}
	default:
		return ""
	}

	return ""
}

// SetBranch writes branch to the provider-specific spec field for git-based repositories,
// mirroring Branch(). It is a no-op for non-git types or when the provider config is absent.
func (r *Repository) SetBranch(branch string) {
	switch r.Spec.Type {
	case GitHubRepositoryType:
		if r.Spec.GitHub != nil {
			r.Spec.GitHub.Branch = branch
		}
	case GitHubEnterpriseRepositoryType:
		if r.Spec.GitHubEnterprise != nil {
			r.Spec.GitHubEnterprise.Branch = branch
		}
	case GitRepositoryType:
		if r.Spec.Git != nil {
			r.Spec.Git.Branch = branch
		}
	case BitbucketRepositoryType:
		if r.Spec.Bitbucket != nil {
			r.Spec.Bitbucket.Branch = branch
		}
	case GitLabRepositoryType:
		if r.Spec.GitLab != nil {
			r.Spec.GitLab.Branch = branch
		}
	default:
		// do nothing
	}
}

// URL returns the URL for git-based repositories
// or an empty string for local repositories
func (r *Repository) URL() string {
	if !r.Spec.Type.IsGit() {
		return ""
	}

	switch r.Spec.Type {
	case GitHubRepositoryType:
		if r.Spec.GitHub != nil {
			return r.Spec.GitHub.URL
		}
	case GitHubEnterpriseRepositoryType:
		if r.Spec.GitHubEnterprise != nil {
			return r.Spec.GitHubEnterprise.URL
		}
	case GitRepositoryType:
		if r.Spec.Git != nil {
			return r.Spec.Git.URL
		}
	case BitbucketRepositoryType:
		if r.Spec.Bitbucket != nil {
			return r.Spec.Bitbucket.URL
		}
	case GitLabRepositoryType:
		if r.Spec.GitLab != nil {
			return r.Spec.GitLab.URL
		}
	default:
		return ""
	}

	return ""
}

func (r *Repository) Path() string {
	switch r.Spec.Type {
	case GitHubRepositoryType:
		if r.Spec.GitHub != nil {
			return r.Spec.GitHub.Path
		}
	case GitHubEnterpriseRepositoryType:
		if r.Spec.GitHubEnterprise != nil {
			return r.Spec.GitHubEnterprise.Path
		}
	case GitRepositoryType:
		if r.Spec.Git != nil {
			return r.Spec.Git.Path
		}
	case BitbucketRepositoryType:
		if r.Spec.Bitbucket != nil {
			return r.Spec.Bitbucket.Path
		}
	case GitLabRepositoryType:
		if r.Spec.GitLab != nil {
			return r.Spec.GitLab.Path
		}
	case LocalRepositoryType:
		if r.Spec.Local != nil {
			return r.Spec.Local.Path
		}
	default:
		return ""
	}

	return ""
}

func (r *Repository) ShouldGenerateDashboardPreviews() bool {
	// GitHub keeps this on its own config until existing repositories are backfilled
	// onto PullRequest options. Every other provider reads it from PullRequest.
	if r.Spec.Type == GitHubRepositoryType {
		return r.Spec.GitHub != nil && r.Spec.GitHub.GenerateDashboardPreviews
	}
	return r.Spec.PullRequest != nil && r.Spec.PullRequest.GenerateDashboardPreviews
}

// ConnectionName returns the name of the connection referenced by this repository,
// or an empty string if the repository does not use a connection.
func (r *Repository) ConnectionName() string {
	if r.Spec.Connection != nil {
		return r.Spec.Connection.Name
	}
	return ""
}

// HasConnection reports whether this repository authenticates through a connection.
func (r *Repository) HasConnection() bool {
	return r.ConnectionName() != ""
}

// SigningMethod selects how commits are signed.
// +enum
type SigningMethod string

const (
	GPGSigningMethod   SigningMethod = "gpg"
	SSHSigningMethod   SigningMethod = "ssh"
	SMIMESigningMethod SigningMethod = "smime"
)

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

	// Resources are saved at the top level without a wrapper folder.
	// Like `folder`, multiple `folderless` repositories may coexist with each
	// other, with `folder` repositories, and with unprovisioned resources.
	// Unlike `folder`, no repo-named container folder is created: files at the
	// repository path root become top-level resources and subdirectories become
	// top-level folders. Ownership is tracked per-resource via manager
	// annotations rather than by folder containment.
	SyncTargetTypeFolderless SyncTargetType = "folderless"
)

// The kubernetes action required when loading a given resource
// +enum
type ResourceAction string

func (ResourceAction) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceAction"
}

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

func (ResourceWrapper) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceWrapper"
}

type ResourceType struct {
	Group    string `json:"group,omitempty"`
	Version  string `json:"version,omitempty"`
	Kind     string `json:"kind,omitempty"`
	Resource string `json:"resource,omitempty"`

	// For non-k8s native formats, what did this start as
	Classic ClassicFileType `json:"classic,omitempty"`
}

func (ResourceType) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceType"
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

func (ResourceObjects) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceObjects"
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

func (ResourceRepositoryInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceRepositoryInfo"
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []FileItem `json:"items"`
}

func (FileList) OpenAPIModelName() string {
	return OpenAPIPrefix + "FileList"
}

type FileItem struct {
	Path     string `json:"path"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	Modified int64  `json:"modified,omitempty"`
	Author   string `json:"author,omitempty"`
}

func (FileItem) OpenAPIModelName() string {
	return OpenAPIPrefix + "FileItem"
}

// Information we can get just from the file listing
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ResourceListItem `json:"items"`
}

func (ResourceList) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceList"
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

func (ResourceListItem) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceListItem"
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

func (ResourceStats) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceStats"
}

type ManagerStats struct {
	// Manager kind
	Kind utils.ManagerKind `json:"kind,omitempty"`

	// Manager identity
	Identity string `json:"id,omitempty"`

	// stats
	Stats []ResourceCount `json:"stats"`
}

func (ManagerStats) OpenAPIModelName() string {
	return OpenAPIPrefix + "ManagerStats"
}

// TestResults is the result of a test connection operation
// Deprecated: this will go way when we deprecate the test endpoint
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// TODO: This type is deprecated and will be removed when we deprecate the test endpoint
// We should use fieldErrors from status instead.
type TestResults struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP status code
	Code int `json:"code"`

	// Is the connection healthy
	Success bool `json:"success"`

	// Field related errors
	Errors []ErrorDetails `json:"errors,omitempty"`
}

func (TestResults) OpenAPIModelName() string {
	return OpenAPIPrefix + "TestResults"
}

// ErrorDetails describes an individual field error intended to help users identify and fix issues
// in resource specifications. This type is modeled after Kubernetes' StatusCause and serves the same
// purpose: to deliver actionable feedback about fields in the spec that require attention.
// Errors may relate to invalid formats, missing or invalid values, or cases where a referenced value
// does not exist in an external system (not strictly format or syntax errors). Use ErrorDetails to
// communicate validation or external reference errors that users can resolve by editing spec fields.
// TODO: Rename this type to FieldError for consistency with Kubernetes conventions and to more clearly indicate that it represents field-level validation errors, not arbitrary error details.
// +k8s:deepcopy-gen=false
type ErrorDetails struct {
	// Type is a machine-readable description of the cause of the error.
	// This is intended for programmatic handling and matches Kubernetes' CauseType values.
	Type metav1.CauseType `json:"type"`

	// Field is the path to the field or JSON pointer that caused the error.
	// This helps users and tools identify exactly where to correct the problem.
	// This field is optional and may be empty if not applicable.
	Field string `json:"field,omitempty"`

	// Detail provides a human-readable explanation of what went wrong.
	// This message may be shown directly to users and should be actionable.
	Detail string `json:"detail,omitempty"`

	// Origin indicates where the error originated in validation, or the name of the external service that reported the error.
	// This can be useful for tooling or debugging, and may reference a specific rule, function, or service.
	// This field is optional and may be empty.
	Origin string `json:"origin,omitempty"`

	// BadValue is the value of the field that was determined to be invalid, if applicable.
	// This can be any type. This field is optional and may be omitted if not relevant.
	BadValue any `json:"badValue,omitempty"`
}

// OpenAPIDefinition describes the inline value, including mutually exclusive operations.
func (ErrorDetails) OpenAPIDefinition() openapicommon.OpenAPIDefinition {
	return openapicommon.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Description: "ErrorDetails describes an individual field error intended to help users identify and fix issues in resource specifications. This type is modeled after Kubernetes' StatusCause and serves the same purpose: to deliver actionable feedback about fields in the spec that require attention. Errors may relate to invalid formats, missing or invalid values, or cases where a referenced value does not exist in an external system (not strictly format or syntax errors). Use ErrorDetails to communicate validation or external reference errors that users can resolve by editing spec fields.",
				Type:        []string{"object"},
				Properties: map[string]spec.Schema{
					"type": {
						SchemaProps: spec.SchemaProps{
							Description: "Type is a machine-readable description of the cause of the error. This is intended for programmatic handling and matches Kubernetes' CauseType values.",
							Default:     "",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"field": {
						SchemaProps: spec.SchemaProps{
							Description: "Field is the path to the field or JSON pointer that caused the error. This helps users and tools identify exactly where to correct the problem. This field is optional and may be empty if not applicable.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"detail": {
						SchemaProps: spec.SchemaProps{
							Description: "Detail provides a human-readable explanation of what went wrong. This message may be shown directly to users and should be actionable.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"origin": {
						SchemaProps: spec.SchemaProps{
							Description: "Origin indicates where the error originated in validation, or the name of the external service that reported the error. This can be useful for tooling or debugging, and may reference a specific rule, function, or service. This field is optional and may be empty.",
							Type:        []string{"string"},
							Format:      "",
						},
					},
					"badValue": {
						// NOTE: the type is not known -- it could be anything
						SchemaProps: spec.SchemaProps{
							Description: "BadValue is the value of the field that was determined to be invalid, if applicable. This can be any type. This field is optional and may be omitted if not relevant.",
						},
					},
				},
				Required: []string{"type"},
			},
		},
	}
}

// DeepCopy copies the receiver, creating a new ErrorDetails.
func (in *ErrorDetails) DeepCopy() *ErrorDetails {
	if in == nil {
		return nil
	}

	out := new(ErrorDetails)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto copies the receiver, writing into out.
func (in *ErrorDetails) DeepCopyInto(out *ErrorDetails) {
	//nolint:errcheck,gosec // this format is taken from the other generated DeepCopyInto functions.
	resource.CopyObjectInto(out, in)
}

func (ErrorDetails) OpenAPIModelName() string {
	return OpenAPIPrefix + "ErrorDetails"
}

// DeletionState is the phase of an in-progress repository deletion.
// +enum
type DeletionState string

func (DeletionState) OpenAPIModelName() string {
	return OpenAPIPrefix + "DeletionState"
}

const (
	// DeletionStateBlocked indicates the latest finalizer pass failed and deletion
	// did not complete. The controller keeps retrying, so a transient failure
	// (a brief outage, an API conflict) may still clear on its own; a persistent
	// one (credentials expired, a webhook that cannot be removed) needs the user
	// to force-remove the blocking finalizer. Finalizer is the finalizer that
	// failed on that pass.
	//
	// This is the only state the controller emits: status.deletion is written
	// only when a pass fails. While finalizers are still running, status.deletion
	// is absent, which (together with a set deletionTimestamp) is itself the
	// "in progress" signal — so no separate Working state is needed.
	DeletionStateBlocked DeletionState = "Blocked"
)

// DeletionCause classifies the error blocking repository deletion.
// +enum
type DeletionCause string

func (DeletionCause) OpenAPIModelName() string {
	return OpenAPIPrefix + "DeletionCause"
}

const (
	// DeletionCauseUser indicates a failure that requires user intervention.
	DeletionCauseUser DeletionCause = "user"
	// DeletionCauseSystem indicates an infrastructure or unclassified failure.
	DeletionCauseSystem DeletionCause = "system"
)

// HistoryList is a list of versions of a resource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HistoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []HistoryItem `json:"items"`
}

func (HistoryList) OpenAPIModelName() string {
	return OpenAPIPrefix + "HistoryList"
}

type Author struct {
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarURL,omitempty"`
}

func (Author) OpenAPIModelName() string {
	return OpenAPIPrefix + "Author"
}

type HistoryItem struct {
	Ref     string `json:"ref"`
	Message string `json:"message"`
	// +listType=atomic
	Authors   []Author `json:"authors"`
	CreatedAt int64    `json:"createdAt"`
}

func (HistoryItem) OpenAPIModelName() string {
	return OpenAPIPrefix + "HistoryItem"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RefList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []RefItem `json:"items"`
}

func (RefList) OpenAPIModelName() string {
	return OpenAPIPrefix + "RefList"
}

type RefItem struct {
	// The name of the reference (branch or tag)
	Name string `json:"name"`
	// The SHA hash of the commit this ref points to
	Hash string `json:"hash,omitempty"`
	// The URL to the reference (branch or tag)
	RefURL string `json:"refURL,omitempty"`
	// Whether this ref is protected (e.g. branch protection rules)
	Protected bool `json:"protected,omitempty"`
}

func (RefItem) OpenAPIModelName() string {
	return OpenAPIPrefix + "RefItem"
}
