package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// BundleFileRepositoryLabel names the repository a bundle file was read from.
	BundleFileRepositoryLabel = GROUP + "/repository"
	// BundleLabel names the bundle an object relates to.
	//
	// On a BundleFile it is the bundle the file belongs to, which is how reconciliation
	// and cleanup find one bundle's files. On a resource that references a bundle it is
	// the bundle it uses, which is the only way to answer "what uses this bundle"
	// without reading the spec of every resource of every linkable kind -- needed both
	// for a "used by" view and to decide whether a bundle may be deleted.
	BundleLabel = GROUP + "/bundle"
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
// Identity is (bundle, path). A file belongs to one bundle and lives and dies with it;
// two bundles declaring the same repository path each store their own copy, so there is
// no sharing to reason about and deletion is simply "with the bundle".
//
// There is no ref: the hash identifies which version of the content is stored, which is
// all a consumer needs to tell a current file from a stale one. Not carrying a ref also
// means a file whose content did not change costs no write when its bundle advances.
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

	// Bundle this file belongs to.
	Bundle string `json:"bundle"`

	// Path is the file's location, relative to the repository root -- the same form
	// every other provisioning path takes.
	Path string `json:"path"`

	// Hash of the decoded content. It is both the change detector and the version a
	// consumer checks: a bundle records the hashes it resolved, so a file whose hash
	// matches is the one the bundle expects.
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
