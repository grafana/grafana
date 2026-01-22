import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  if (loadedFromRef && loadedFromRef !== config?.branch) {
    return 'write'; // use write when the value targets an explicit ref
  }
  return config?.workflows?.[0];
}

export function getCanPushToConfiguredBranch(repository?: RepositoryView) {
  return repository?.workflows.includes('write') ?? false;
}
