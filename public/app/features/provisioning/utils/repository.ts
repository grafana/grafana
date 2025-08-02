import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export function getIsReadOnlyRepo(repository: RepositoryView | undefined): boolean {
  if (!repository) {
    return false;
  }

  return repository.workflows.length === 0;
}
