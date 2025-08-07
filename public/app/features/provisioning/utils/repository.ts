import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export function getIsReadOnlyRepo(repository: RepositoryView | undefined): boolean {
  if (!repository) {
    return false;
  }

  // Repository is consider read-only if it has no workflows defined (workflows are required for write operations)
  return repository.workflows.length === 0;
}
