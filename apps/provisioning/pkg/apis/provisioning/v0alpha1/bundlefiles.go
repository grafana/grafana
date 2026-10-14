package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// BundleFileRepositoryLabel names the repository a bundle file was read from. Listing by
// it is how reconciliation and cleanup find the files of a repository.
//
// There is deliberately no bundle label: a file may be claimed by any number of bundles,
// so the reference lives on the bundle side and a label could not express it.
const BundleFileRepositoryLabel = GROUP + "/repository"

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
// Identity is (repository, path): a file belongs to a repository, not to one bundle, and
// any number of bundles may claim it. A shared asset is therefore stored once, and is
// removed only once no bundle references it.
//
// There is no ref: the hash identifies which version of the content is stored, which is
// all a consumer needs to tell a current file from a stale one. Not carrying a ref also
// means a file whose content did not change costs no write when a bundle advances.
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
