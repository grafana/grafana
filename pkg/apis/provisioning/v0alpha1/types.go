package v0alpha1

import (
	"encoding/json"
	"errors"
	"fmt"

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

func (r *LocalRepository) IsEmpty() bool {
	return r == nil || r.Path == ""
}

type S3Repository struct {
	Bucket string `json:"bucket,omitempty"`

	// TODO: Add ACL?
	// TODO: Encryption??
	// TODO: How do we define access? Secrets?
}

func (r *S3Repository) IsEmpty() bool {
	return r == nil || r.Bucket == ""
}

type GitHubRepository struct {
	// The owner of the repository (e.g. example in `example/test` or `https://github.com/example/test`).
	Owner string `json:"owner,omitempty"`
	// The name of the repository (e.g. test in `example/test` or `https://github.com/example/test`).
	Repository string `json:"repository,omitempty"`

	// TODO: Do we want an SSH url instead maybe?
	// TODO: On-prem GitHub Enterprise support?
	// TODO: How do we define access? Secrets?

	// Whether we should commit to change branches and use a Pull Request flow to achieve this.
	// By default, this is false (i.e. we will commit straight to the main branch).
	BranchWorkflow bool `json:"branchWorkflow,omitempty"`

	// Whether we should show dashboard previews in the pull requests caused by the BranchWorkflow option.
	// By default, this is false (i.e. we will not create previews).
	// This option is a no-op if BranchWorkflow is `false` or default.
	GenerateDashboardPreviews bool `json:"generateDashboardPreviews,omitempty"`
}

func (r *GitHubRepository) IsEmpty() bool {
	// we don't need to check options here, just the most important stuff to actually connect.
	return r == nil || r.Owner == "" || r.Repository == ""
}

type RepositorySpec struct {
	// The folder that is backed by the repository.
	// The value is a reference to the Kubernetes metadata name of the folder in the same namespace.
	Folder string `json:"folder,omitempty"`

	// The repository on the local file system.
	// Mutually exclusive with s3 and github.
	Local LocalRepository `json:"local,omitempty"`
	// The repository in an S3 bucket.
	// Mutually exclusive with local and github.
	S3 S3Repository `json:"s3,omitempty"`
	// The repository on GitHub.
	// Mutually exclusive with local and s3.
	// TODO: github or just 'git'??
	GitHub GitHubRepository `json:"github,omitempty"`
}

func (s *RepositorySpec) UnmarshalJSON(data []byte) error {
	type Alias RepositorySpec
	real := struct {
		*Alias `json:",inline"`
	}{(*Alias)(s)}

	if err := json.Unmarshal(data, &real); err != nil {
		return err
	}

	nonEmpty := 0
	type IsEmptyer interface{ IsEmpty() bool }
	for _, it := range []IsEmptyer{&real.GitHub, &real.S3, &real.Local} {
		if !it.IsEmpty() {
			nonEmpty++
		}
	}
	if nonEmpty != 1 {
		return fmt.Errorf("%w (found %d)", errors.New("one (and exactly one) of github, s3, and local must be set"), nonEmpty)
	}

	return nil
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Repository `json:"items,omitempty"`
}
