package v1beta2

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// The request and response bodies of the repository and connection subresources and of the
// namespace routes. They are not kinds, so they are hand-written rather than generated from CUE.
// Their JSON matches v0alpha1 exactly; Go field names follow the generated v1beta2 types, which
// capitalize the JSON name.

const openAPIPrefix = "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta2."

func init() {
	localSchemeBuilder.Register(addSubresourceKnownTypes)
}

func addSubresourceKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(GroupVersion,
		&TestResults{},
		&ResourceWrapper{},
		&FileList{},
		&RefList{},
		&ResourceList{},
		&ResourceCountList{},
		&ResourceStats{},
		&HistoryList{},
		&WebhookResponse{},
		&ExternalRepositoryList{},
		&ConnectionAuthorizeRequest{},
		&RepositoryViewList{},
	)
	return nil
}

// TestResults is the response of the repository test subresource.
// RepositoryErrorDetails has no generated DeepCopyInto, so TestResults is copied by hand.
// +k8s:deepcopy-gen=false
// +k8s:openapi-gen=true
type TestResults struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP status code
	Code int `json:"code"`

	// Is the connection healthy
	Success bool `json:"success"`

	// Field related errors
	// +listType=atomic
	Errors []RepositoryErrorDetails `json:"errors,omitempty"`
}

func (TestResults) OpenAPIModelName() string {
	return openAPIPrefix + "TestResults"
}

func (in *TestResults) DeepCopyInto(out *TestResults) {
	//nolint:errcheck,gosec // in and out are non-nil pointers to the same struct type.
	resource.CopyObjectInto(out, in)
}

func (in *TestResults) DeepCopy() *TestResults {
	if in == nil {
		return nil
	}
	out := new(TestResults)
	in.DeepCopyInto(out)
	return out
}

func (in *TestResults) DeepCopyObject() runtime.Object {
	return in.DeepCopy()
}

// The kubernetes action required when loading a given resource
// +enum
// +k8s:openapi-gen=true
type ResourceAction string

func (ResourceAction) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceAction"
}

const (
	ResourceActionCreate ResourceAction = "create"
	ResourceActionUpdate ResourceAction = "update"
	ResourceActionDelete ResourceAction = "delete"
	ResourceActionMove   ResourceAction = "move"
)

// File types used from classic provisioning
// +enum
// +k8s:openapi-gen=true
type ClassicFileType string

func (ClassicFileType) OpenAPIModelName() string {
	return openAPIPrefix + "ClassicFileType"
}

const (
	ClassicFileTypeDashboard     ClassicFileType = "dashboard"
	ClassicFileTypeDatasources   ClassicFileType = "datasources"
	ClassicFileTypeAlerting      ClassicFileType = "alerting"
	ClassicFileTypeAccessControl ClassicFileType = "access-control"
)

// ResourceWrapper is the response of the repository files subresource for a single file.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
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
	Urls *RepositoryURLs `json:"urls,omitempty"`

	// The modified time in the remote file system
	Timestamp *metav1.Time `json:"timestamp,omitempty"`

	// Different flavors of the same object
	Resource ResourceObjects `json:"resource"`

	// If errors exist, show them here
	// +listType=atomic
	Errors []string `json:"errors,omitempty"`
}

func (ResourceWrapper) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceWrapper"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ResourceType struct {
	Group    string `json:"group,omitempty"`
	Version  string `json:"version,omitempty"`
	Kind     string `json:"kind,omitempty"`
	Resource string `json:"resource,omitempty"`

	// For non-k8s native formats, what did this start as
	Classic ClassicFileType `json:"classic,omitempty"`
}

func (ResourceType) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceType"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
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
	return openAPIPrefix + "ResourceObjects"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ResourceRepositoryInfo struct {
	// The repository type
	Type RepositorySpecType `json:"type"`

	// The display name for this repository
	Title string `json:"title"`

	// The namespace this belongs to
	Namespace string `json:"namespace"`

	// The name (identifier)
	Name string `json:"name"`
}

func (ResourceRepositoryInfo) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceRepositoryInfo"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
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

func (RepositoryURLs) OpenAPIModelName() string {
	return openAPIPrefix + "RepositoryURLs"
}

// FileList is the response of the repository files subresource for a directory.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type FileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []FileItem `json:"items"`
}

func (FileList) OpenAPIModelName() string {
	return openAPIPrefix + "FileList"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type FileItem struct {
	Path     string `json:"path"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	Modified int64  `json:"modified,omitempty"`
	Author   string `json:"author,omitempty"`
}

func (FileItem) OpenAPIModelName() string {
	return openAPIPrefix + "FileItem"
}

// ResourceList is the response of the repository resources subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type ResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ResourceListItem `json:"items"`
}

func (ResourceList) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceList"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ResourceListItem struct {
	Path     string `json:"path"`
	Group    string `json:"group"`
	Resource string `json:"resource"`
	// The k8s identifier
	Name string `json:"name"`
	Hash string `json:"hash"`
	Time int64  `json:"time,omitempty"`

	Title  string `json:"title,omitempty"`
	Folder string `json:"folder,omitempty"`
}

func (ResourceListItem) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceListItem"
}

// ResourceStats is the response of the namespace stats route.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
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
	return openAPIPrefix + "ResourceStats"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ManagerStats struct {
	// Manager kind
	Kind utils.ManagerKind `json:"kind,omitempty"`

	// Manager identity
	Id string `json:"id,omitempty"`

	// stats
	// +listType=atomic
	Stats []ResourceCount `json:"stats"`
}

func (ManagerStats) OpenAPIModelName() string {
	return openAPIPrefix + "ManagerStats"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ResourceCount struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

func (ResourceCount) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceCount"
}

// ResourceCountList is the response of the repository stats subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type ResourceCountList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ResourceCount `json:"items"`
}

func (ResourceCountList) OpenAPIModelName() string {
	return openAPIPrefix + "ResourceCountList"
}

// HistoryList is the response of the repository history subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type HistoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []HistoryItem `json:"items"`
}

func (HistoryList) OpenAPIModelName() string {
	return openAPIPrefix + "HistoryList"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type Author struct {
	Name      string `json:"name"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatarURL,omitempty"`
}

func (Author) OpenAPIModelName() string {
	return openAPIPrefix + "Author"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type HistoryItem struct {
	Ref     string `json:"ref"`
	Message string `json:"message"`
	// +listType=atomic
	Authors   []Author `json:"authors"`
	CreatedAt int64    `json:"createdAt"`
}

func (HistoryItem) OpenAPIModelName() string {
	return openAPIPrefix + "HistoryItem"
}

// RefList is the response of the repository refs subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type RefList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []RefItem `json:"items"`
}

func (RefList) OpenAPIModelName() string {
	return openAPIPrefix + "RefList"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
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
	return openAPIPrefix + "RefItem"
}

// WebhookResponse is the response of the repository webhook subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type WebhookResponse struct {
	metav1.TypeMeta `json:",inline"`

	// HTTP Status code
	// 200 implies that the payload was understood but nothing is required
	// 202 implies that an async job has been scheduled to handle the request
	Code int `json:"code,omitempty"`

	// Optional message
	Added string `json:"added,omitempty"`

	// Jobs to be processed
	// When the response is 202 (Accepted) the queued jobs will be returned
	Job *JobSpec `json:"job,omitempty"`
}

func (WebhookResponse) OpenAPIModelName() string {
	return openAPIPrefix + "WebhookResponse"
}

// ExternalRepositoryList is the response of the connection repositories subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type ExternalRepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ExternalRepository `json:"items"`
}

func (ExternalRepositoryList) OpenAPIModelName() string {
	return openAPIPrefix + "ExternalRepositoryList"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ExternalRepository struct {
	// Name of the repository
	Name string `json:"name"`
	// Owner is the user, organization, or workspace that owns the repository
	// For GitHub: organization or user
	// For GitLab: namespace (user or group)
	// For Bitbucket: workspace
	// For pure Git: empty
	Owner string `json:"owner,omitempty"`
	// URL of the repository
	Url string `json:"url"`
}

func (ExternalRepository) OpenAPIModelName() string {
	return openAPIPrefix + "ExternalRepository"
}

// ConnectionAuthorizeRequest completes the OAuth authorization of a connection
// by exchanging an authorization code for tokens. It is the request and
// response body of the connection authorize subresource.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type ConnectionAuthorizeRequest struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ConnectionAuthorizeRequestSpec `json:"spec"`

	// +optional
	Status ConnectionAuthorizeRequestStatus `json:"status,omitempty"`
}

func (ConnectionAuthorizeRequest) OpenAPIModelName() string {
	return openAPIPrefix + "ConnectionAuthorizeRequest"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ConnectionAuthorizeRequestSpec struct {
	// The authorization code returned by the provider
	Code string `json:"code"`

	// The redirect URI used in the authorization request
	RedirectURI string `json:"redirectURI,omitempty"`
}

func (ConnectionAuthorizeRequestSpec) OpenAPIModelName() string {
	return openAPIPrefix + "ConnectionAuthorizeRequestSpec"
}

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type ConnectionAuthorizeRequestStatus struct {
	// Whether the connection has been authorized
	Authorized bool `json:"authorized"`
}

func (ConnectionAuthorizeRequestStatus) OpenAPIModelName() string {
	return openAPIPrefix + "ConnectionAuthorizeRequestStatus"
}

// RepositoryViewList is the response of the namespace settings route. It shows a view of the
// configuration that is sanitized and is OK for logged in users to see.
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type RepositoryViewList struct {
	metav1.TypeMeta `json:",inline"`

	// The valid targets (can disable instance or folder types)
	// +listType=atomic
	AllowedTargets []RepositorySyncOptionsTarget `json:"allowedTargets,omitempty"`

	// Whether image rendering is allowed for dashboard previews
	AllowImageRendering bool `json:"allowImageRendering"`

	// MaxRepositories is the maximum number of repositories allowed per namespace (0 = unlimited)
	MaxRepositories int64 `json:"maxRepositories"`

	// AvailableRepositoryTypes is the list of repository types supported in this instance (e.g. git, bitbucket, github, etc)
	// +listType=atomic
	AvailableRepositoryTypes []RepositorySpecType `json:"availableRepositoryTypes,omitempty"`

	// AvailableConnectionTypes is the list of connection types supported in this instance
	// +listType=atomic
	AvailableConnectionTypes []ConnectionType `json:"availableConnectionTypes,omitempty"`

	// AvailableResources is the list of resource types declared for provisioning in this
	// instance, including disabled ones (see SupportedResource.Disabled).
	// +listType=atomic
	AvailableResources []SupportedResource `json:"availableResources,omitempty"`

	// +listType=atomic
	Items []RepositoryView `json:"items"`
}

func (RepositoryViewList) OpenAPIModelName() string {
	return openAPIPrefix + "RepositoryViewList"
}

// SupportedResource describes a resource type declared for provisioning. A resource is
// identified by its group and kind; the API version and plural resource are resolved at
// runtime via discovery, so they are not part of this descriptor.
// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
type SupportedResource struct {
	// Group is the API group of the resource (e.g. "dashboard.grafana.app").
	Group string `json:"group"`

	// Kind is the kind of the resource (e.g. "Dashboard").
	Kind string `json:"kind"`

	// Disabled reports whether the resource is declared but not acted on by provisioning.
	// Active resources omit this field.
	Disabled bool `json:"disabled,omitempty"`
}

func (SupportedResource) OpenAPIModelName() string {
	return openAPIPrefix + "SupportedResource"
}

// The generated repository option types have no DeepCopyInto, so RepositoryView is copied by hand.
// +k8s:deepcopy-gen=false
// +k8s:openapi-gen=true
type RepositoryView struct {
	// The k8s name for this repository
	Name string `json:"name"`

	// Repository display
	Title string `json:"title"`

	// The repository type
	Type RepositorySpecType `json:"type"`

	// When syncing, where values are saved
	Target RepositorySyncOptionsTarget `json:"target"`

	// For git, this is the target branch
	Branch string `json:"branch,omitempty"`

	// For git, this is the target URL
	Url string `json:"url,omitempty"`

	// For git, this is the target path
	Path string `json:"path,omitempty"`

	// The supported workflows
	// +listType=atomic
	Workflows []RepositorySpecWorkflows `json:"workflows"`

	// Commit message options. Mirrors the same-named field on the repository spec.
	Commit *RepositoryCommitOptions `json:"commit,omitempty"`

	// Branch naming options. Mirrors spec.branch. Exposed under `branchOptions`
	// rather than `branch` because the view already uses `branch` for the git
	// target branch name.
	BranchOptions *RepositoryBranchOptions `json:"branchOptions,omitempty"`

	// Pull request options. Mirrors the same-named field on the repository spec.
	PullRequest *RepositoryPullRequestOptions `json:"pullRequest,omitempty"`
}

func (RepositoryView) OpenAPIModelName() string {
	return openAPIPrefix + "RepositoryView"
}

func (in *RepositoryView) DeepCopyInto(out *RepositoryView) {
	//nolint:errcheck,gosec // in and out are non-nil pointers to the same struct type.
	resource.CopyObjectInto(out, in)
}

func (in *RepositoryView) DeepCopy() *RepositoryView {
	if in == nil {
		return nil
	}
	out := new(RepositoryView)
	in.DeepCopyInto(out)
	return out
}
