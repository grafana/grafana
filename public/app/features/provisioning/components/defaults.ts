import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { generateNewBranchName } from './utils/newBranchName';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  if (loadedFromRef && loadedFromRef !== config?.branch) {
    return 'write'; // use write when the value targets an explicit ref
  }
  return config?.workflows?.[0];
}

export function getCanPushToConfiguredBranch(repository?: RepositoryView) {
  return repository?.workflows?.includes('write') ?? false;
}

export function getDefaultRef(repository: RepositoryView | undefined, branchPrefix: string, loadedFromRef?: string) {
  const workflow = getDefaultWorkflow(repository, loadedFromRef);
  return workflow === 'branch' ? generateNewBranchName(branchPrefix) : (repository?.branch ?? '');
}
