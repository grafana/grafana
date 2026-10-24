package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Bundle groups a set of repository files so that another resource can use them.
//
// Resources whose definition needs more than their own file -- markdown, scripts,
// queries, data the resource pipeline cannot parse -- point at a Bundle instead of
// carrying the file set themselves. That keeps the file set out of the consuming kind's
// schema: the consumer declares only which bundle it uses, and the bundle owns everything
// about the files.
//
// In a repository a bundle is therefore two manifests: the Bundle, and the resource that
// references it.
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Bundle struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   BundleSpec   `json:"spec,omitempty"`
	Status BundleStatus `json:"status,omitempty"`
}

func (Bundle) OpenAPIModelName() string {
	return OpenAPIPrefix + "Bundle"
}

type BundleSpec struct {
	// Paths belonging to this bundle, relative to the repository root -- the same form
	// every other provisioning path takes.
	//
	// A path with a trailing "/" is a folder, and everything beneath it belongs to the
	// bundle; anything else is a single file. Selection is by path only: a repository
	// path is already the addressing scheme provisioning uses everywhere, and a declared
	// path is readable in a diff.
	//
	// These are what the author declared; what they resolved to is status.files.
	//
	// +listType=atomic
	Paths []string `json:"paths,omitempty"`
}

func (BundleSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleSpec"
}

type BundleStatus struct {
	// Ref is the repository ref the files below were resolved at. Without it a resolved
	// list is a claim with no referent: neither staleness nor safe deletion could be
	// determined from it.
	Ref string `json:"ref,omitempty"`

	// Files the bundle resolved to at Ref, after expanding folders. Unlike spec.paths
	// these are always files.
	//
	// Each entry names the BundleFile holding it, so this is the index a consumer reads
	// to fetch content: one GET of the bundle yields every name, hash and size, and the
	// files are then fetched directly by name. Without the name a client would have to
	// either list bundle files by label -- which returns all of their content -- or
	// recompute the name from the path, duplicating a hash the server owns.
	//
	// +listType=atomic
	Files []BundleFileRef `json:"files,omitempty"`

	// Unresolved are spec.paths entries that matched nothing at Ref. Reported rather than
	// hidden, so a folder renamed away surfaces instead of quietly emptying the bundle.
	// +listType=atomic
	Unresolved []string `json:"unresolved,omitempty"`

	// +listType=atomic
	// +mapType=atomic
	Conditions []metav1.Condition `json:"conditions,omitempty"`
}

func (BundleStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleStatus"
}

// BundleFileRef points at one file a bundle resolved to.
type BundleFileRef struct {
	// Path in the repository, relative to its root.
	Path string `json:"path"`

	// Name of the BundleFile resource holding this file's content.
	Name string `json:"name"`

	// Hash of the decoded content. A consumer compares it against the stored file to
	// know it has the version this bundle published.
	Hash string `json:"hash,omitempty"`

	// Size of the decoded content in bytes.
	Size int64 `json:"size,omitempty"`
}

func (BundleFileRef) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleFileRef"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type BundleList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Bundle `json:"items"`
}

func (BundleList) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleList"
}
