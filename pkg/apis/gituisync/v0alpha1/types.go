package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Repository struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec RepositorySpec `json:"spec,omitempty"`
}

type LocalRepository struct {
	Path string `json:"path,omitempty"`
}

type S3Repository struct {
	Bucket string `json:"bucket,omitempty"`
	// TODO: Add ACL?
	// TODO: Encryption??
}

type GitHubRepository struct {
	Owner      string `json:"owner,omitempty"`
	Repository string `json:"repository,omitempty"`
	// TODO: Do we want an SSH url instead maybe?
	// TODO: On-prem GitHub Enterprise support?
}

type RepositorySpec struct {
	// The repository on the local file system.
	// Mutually exclusive with s3 and github.
	Local LocalRepository `json:"local,omitempty"`
	// The repository in an S3 bucket.
	// Mutually exclusive with local and github.
	S3 S3Repository `json:"s3,omitempty"`
	// The repository on GitHub.
	// Mutually exclusive with local and s3.
	// TODO: github or just 'git'??
	GitHubRepository GitHubRepository `json:"github,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Repository `json:"items,omitempty"`
}
