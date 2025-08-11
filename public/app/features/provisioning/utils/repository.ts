import { RepositoryView, RepoWorkflows } from 'app/api/clients/provisioning/v0alpha1';

export function getIsReadOnlyWorkflows(workflows?: RepoWorkflows): boolean {
  // Repository is consider read-only if it has no workflows defined (workflows are required for write operations)
  return workflows?.length === 0;
}

export function getIsReadOnlyRepo(repository: RepositoryView | undefined): boolean {
  if (!repository) {
    return false;
  }

  return getIsReadOnlyWorkflows(repository.workflows);
}
