import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { generateNewBranchName } from './utils/newBranchName';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  if (loadedFromRef && loadedFromRef !== config?.branch) {
    return 'write'; // use write when the value targets an explicit ref
  }
  // When the branch name template is enforced, saves must go through the branch workflow so the
  // templated branch name is applied and sent as `ref` (never a direct push to the configured branch).
  if (config?.branchOptions?.enforceTemplate && config?.workflows?.includes('branch')) {
    return 'branch';
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
