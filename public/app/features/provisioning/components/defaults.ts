import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { generateNewBranchName } from './utils/newBranchName';

export function getDefaultWorkflow(config?: RepositoryView, loadedFromRef?: string) {
  // An enforced branch name template has to be created and sent as `ref`, which a write default
  // would drop, so it wins even over an explicit ref. Same conditions useBranchTemplate needs to
  // apply the template (usable template, branch workflow available), so the default only switches
  // when the template will actually be applied.
  const { enforceTemplate, nameTemplate } = config?.branchOptions ?? {};
  if (enforceTemplate && nameTemplate?.trim() && config?.workflows?.includes('branch')) {
    return 'branch';
  }
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
