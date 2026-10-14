package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// BundleFileRepositoryLabel names the repository a bundle file was read from.
	BundleFileRepositoryLabel = GROUP + "/repository"
	// BundleFileBundleLabel names the bundle that claims a file. Listing by this label
	// is how reconciliation and cleanup find a bundle's files.
	BundleFileBundleLabel = GROUP + "/bundle"
)

// BundleFile is a copy of one supporting file of a bundle, as it was at a particular
// repository ref.
//
// Bundles are resources whose definition spans a set of files the resource pipeline
// cannot parse. Storing each of those files here rather than reading them from the
// provider on demand gives them ordinary resource authorization, keeps the provider out
// of the read path, and lets consumers watch them. The repository stays authoritative:
// a BundleFile is derived, server-owned and overwritten from the repository on every
// sync, never written by a user.
//
// Identity is (bundle, path) and the ref is a field, not part of the name: when a bundle
// advances to a newer ref each of its files is either updated in place or deleted, and a
// name cannot be updated. So for a bundle at its current ref there is exactly one
// BundleFile per claimed path.
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type BundleFile struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec BundleFileSpec `json:"spec,omitempty"`
}

func (BundleFile) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleFile"
}

type BundleFileSpec struct {
	// Repository this file was read from.
	Repository string `json:"repository"`

	// Bundle resource that claims this file. A file belongs to exactly one bundle.
	Bundle string `json:"bundle"`

	// Path is the file's location, relative to the repository root -- the same form
	// every other provisioning path takes.
	Path string `json:"path"`

	// Ref is the repository ref this copy was read at. A consumer needing a consistent
	// view compares it against the owning bundle's published ref and retries on a
	// mismatch: files are updated in place, so there is a brief window during which a
	// changed file is ahead of the bundle.
	Ref string `json:"ref"`

	// Hash of the decoded content, used to tell a file that moved refs without changing
	// from one that has to be rewritten.
	Hash string `json:"hash,omitempty"`

	// Size of the decoded content in bytes.
	Size int64 `json:"size,omitempty"`

	// Content of the file, base64-encoded. Always encoded, whatever the file holds:
	// bundles carry arbitrary files, and a single representation avoids both guessing
	// at text and silently mangling anything that is not valid UTF-8.
	Content string `json:"content,omitempty"`
}

func (BundleFileSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleFileSpec"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type BundleFileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []BundleFile `json:"items"`
}

func (BundleFileList) OpenAPIModelName() string {
	return OpenAPIPrefix + "BundleFileList"
}
