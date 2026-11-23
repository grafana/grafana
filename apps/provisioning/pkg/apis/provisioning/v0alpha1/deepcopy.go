package v0alpha1

import "github.com/grafana/grafana-app-sdk/resource"

// RepositoryView embeds these generated types. deepcopy-gen expects them to have deepcopy
// functions, but the SDK only generates them for kinds, specs and statuses.

func (in *RepositoryCommitOptions) DeepCopyInto(out *RepositoryCommitOptions) {
	_ = resource.CopyObjectInto(out, in)
}

func (in *RepositoryCommitOptions) DeepCopy() *RepositoryCommitOptions {
	out := &RepositoryCommitOptions{}
	in.DeepCopyInto(out)
	return out
}

func (in *RepositoryBranchOptions) DeepCopyInto(out *RepositoryBranchOptions) {
	_ = resource.CopyObjectInto(out, in)
}

func (in *RepositoryBranchOptions) DeepCopy() *RepositoryBranchOptions {
	out := &RepositoryBranchOptions{}
	in.DeepCopyInto(out)
	return out
}

func (in *RepositoryPullRequestOptions) DeepCopyInto(out *RepositoryPullRequestOptions) {
	_ = resource.CopyObjectInto(out, in)
}

func (in *RepositoryPullRequestOptions) DeepCopy() *RepositoryPullRequestOptions {
	out := &RepositoryPullRequestOptions{}
	in.DeepCopyInto(out)
	return out
}
