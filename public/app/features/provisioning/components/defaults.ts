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

/**
 * Whether an enforced branch name template should force the save/push forms onto the branch workflow.
 * Mirrors the conditions useBranchTemplate uses to activate — the gitConventions flag plus a usable
 * nameTemplate on a repository that supports the branch workflow — so the workflow is only switched
 * when the template will actually be applied and sent as `ref`.
 */
export function shouldEnforceBranchTemplate(
  config: RepositoryView | undefined,
  gitConventionsEnabled: boolean
): boolean {
  return (
    gitConventionsEnabled &&
    Boolean(config?.branchOptions?.enforceTemplate) &&
    Boolean(config?.branchOptions?.nameTemplate?.trim()) &&
    Boolean(config?.workflows?.includes('branch'))
  );
}
