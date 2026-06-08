package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Summary shows a view of the configuration that is sanitized and is OK for logged in users to see
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryViewList struct {
	metav1.TypeMeta `json:",inline"`

	// The valid targets (can disable instance or folder types)
	AllowedTargets []SyncTargetType `json:"allowedTargets,omitempty"`

	// Whether image rendering is allowed for dashboard previews
	AllowImageRendering bool `json:"allowImageRendering"`

	// MaxRepositories is the maximum number of repositories allowed per namespace (0 = unlimited)
	MaxRepositories int64 `json:"maxRepositories"`

	// AvailableRepositoryTypes is the list of repository types supported in this instance (e.g. git, bitbucket, github, etc)
	AvailableRepositoryTypes []RepositoryType `json:"availableRepositoryTypes,omitempty"`

	// AvailableResources is the list of resource types declared for provisioning in this
	// instance, including disabled ones (see SupportedResource.Disabled).
	AvailableResources []SupportedResource `json:"availableResources,omitempty"`

	// +mapType=atomic
	Items []RepositoryView `json:"items"`
}

// SupportedResource describes a resource type declared for provisioning. A resource is
// identified by its group and kind; the API version and plural resource are resolved at
// runtime via discovery, so they are not part of this descriptor.
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
	return OpenAPIPrefix + "SupportedResource"
}

func (RepositoryViewList) OpenAPIModelName() string {
	return OpenAPIPrefix + "RepositoryViewList"
}

type RepositoryView struct {
	// The k8s name for this repository
	Name string `json:"name"`

	// Repository display
	Title string `json:"title"`

	// The repository type
	Type RepositoryType `json:"type"`

	// When syncing, where values are saved
	Target SyncTargetType `json:"target"`

	// For git, this is the target branch
	Branch string `json:"branch,omitempty"`

	// For git, this is the target URL
	URL string `json:"url,omitempty"`

	// For git, this is the target path
	Path string `json:"path,omitempty"`

	// The supported workflows
	Workflows []Workflow `json:"workflows"`

	// Commit message options. Mirrors the same-named field on the repository spec.
	Commit *CommitOptions `json:"commit,omitempty"`
}

func (RepositoryView) OpenAPIModelName() string {
	return OpenAPIPrefix + "RepositoryView"
}
