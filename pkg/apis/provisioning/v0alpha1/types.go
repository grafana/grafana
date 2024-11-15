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

type LocalRepositoryConfig struct {
	Path string `json:"path,omitempty"`
}

type S3RepositoryConfig struct {
	Region string `json:"region,omitempty"`
	Bucket string `json:"bucket,omitempty"`

	// TODO: Add ACL?
	// TODO: Encryption??
	// TODO: How do we define access? Secrets?
}

type GitHubRepositoryConfig struct {
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

// RepositoryType defines the types of Repository
// +enum
type RepositoryType string

// RepositoryType values
const (
	LocalRepositoryType  RepositoryType = "local"
	S3RepositoryType     RepositoryType = "s3"
	GithubRepositoryType RepositoryType = "github"
)

type RepositorySpec struct {
	// Describe the feature toggle
	Title string `json:"title"`

	// Describe the feature toggle
	Description string `json:"description,omitempty"`

	// The folder that is backed by the repository.
	// The value is a reference to the Kubernetes metadata name of the folder in the same namespace.
	Folder string `json:"folder,omitempty"`

	// The repository type.  When selected oneOf the values below should be non-nil
	Type RepositoryType `json:"type"`

	// The repository on the local file system.
	// Mutually exclusive with s3 and github.
	Local *LocalRepositoryConfig `json:"local,omitempty"`

	// The repository in an S3 bucket.
	// Mutually exclusive with local and github.
	S3 *S3RepositoryConfig `json:"s3,omitempty"`

	// The repository on GitHub.
	// Mutually exclusive with local and s3.
	// TODO: github or just 'git'??
	GitHub *GitHubRepositoryConfig `json:"github,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Repository `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HelloWorld struct {
	metav1.TypeMeta `json:",inline"`

	Whom string `json:"whom,omitempty"`
}

// Dummy object to return for webhooks
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type WebhookResponse struct {
	metav1.TypeMeta `json:",inline"`

	Status string `json:"status,omitempty"`
}
