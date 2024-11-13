package v0alpha1

// Defines values for RepositoryGitHubRepoType.
const (
	RepositoryGitHubRepoTypeGithub RepositoryGitHubRepoType = "github"
)

// Defines values for RepositoryLocalRepoType.
const (
	RepositoryLocalRepoTypeLocal RepositoryLocalRepoType = "local"
)

// Defines values for RepositoryS3RepoType.
const (
	RepositoryS3RepoTypeS3 RepositoryS3RepoType = "s3"
)

// Defines values for RepositoryspecGitHubRepoType.
const (
	RepositoryspecGitHubRepoTypeGithub RepositoryspecGitHubRepoType = "github"
)

// Defines values for RepositoryspecLocalRepoType.
const (
	RepositoryspecLocalRepoTypeLocal RepositoryspecLocalRepoType = "local"
)

// Defines values for RepositoryspecS3RepoType.
const (
	RepositoryspecS3RepoTypeS3 RepositoryspecS3RepoType = "s3"
)

// RepositoryGitHubRepo defines model for RepositoryGitHubRepo.
// +k8s:openapi-gen=true
type RepositoryGitHubRepo struct {
	// TODO: Do we want an SSH url instead maybe?
	Owner string `json:"owner"`

	// TODO: On-prem GitHub Enterprise support?
	Repository string `json:"repository"`

	// TODO: github or just 'git'??
	Type RepositoryGitHubRepoType `json:"type"`
}

// TODO: github or just 'git'??
// +k8s:openapi-gen=true
type RepositoryGitHubRepoType string

// RepositoryLocalRepo defines model for RepositoryLocalRepo.
// +k8s:openapi-gen=true
type RepositoryLocalRepo struct {
	Path string                  `json:"path"`
	Type RepositoryLocalRepoType `json:"type"`
}

// RepositoryLocalRepoType defines model for RepositoryLocalRepo.Type.
// +k8s:openapi-gen=true
type RepositoryLocalRepoType string

// RepositoryS3Repo defines model for RepositoryS3Repo.
// +k8s:openapi-gen=true
type RepositoryS3Repo struct {
	// TODO: Add ACL?
	// TODO: Encryption??
	Bucket string               `json:"bucket"`
	Type   RepositoryS3RepoType `json:"type"`
}

// RepositoryS3RepoType defines model for RepositoryS3Repo.Type.
// +k8s:openapi-gen=true
type RepositoryS3RepoType string

// RepositorySpec defines model for RepositorySpec.
// +k8s:openapi-gen=true
type RepositorySpec struct {
	Repository interface{} `json:"repository"`
}

// RepositoryspecGitHubRepo defines model for Repositoryspec.#GitHubRepo.
// +k8s:openapi-gen=true
type RepositoryspecGitHubRepo struct {
	// TODO: Do we want an SSH url instead maybe?
	Owner string `json:"owner"`

	// TODO: On-prem GitHub Enterprise support?
	Repository string `json:"repository"`

	// TODO: github or just 'git'??
	Type RepositoryspecGitHubRepoType `json:"type"`
}

// TODO: github or just 'git'??
// +k8s:openapi-gen=true
type RepositoryspecGitHubRepoType string

// RepositoryspecLocalRepo defines model for Repositoryspec.#LocalRepo.
// +k8s:openapi-gen=true
type RepositoryspecLocalRepo struct {
	Path string                      `json:"path"`
	Type RepositoryspecLocalRepoType `json:"type"`
}

// RepositoryspecLocalRepoType defines model for RepositoryspecLocalRepo.Type.
// +k8s:openapi-gen=true
type RepositoryspecLocalRepoType string

// RepositoryspecS3Repo defines model for Repositoryspec.#S3Repo.
// +k8s:openapi-gen=true
type RepositoryspecS3Repo struct {
	// TODO: Add ACL?
	// TODO: Encryption??
	Bucket string                   `json:"bucket"`
	Type   RepositoryspecS3RepoType `json:"type"`
}

// RepositoryspecS3RepoType defines model for RepositoryspecS3Repo.Type.
// +k8s:openapi-gen=true
type RepositoryspecS3RepoType string
