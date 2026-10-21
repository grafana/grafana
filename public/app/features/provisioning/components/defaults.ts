import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { generateNewBranchName } from './utils/newBranchName';

export function getCanPushToConfiguredBranch(repository?: RepositoryView) {
  return repository?.workflows?.includes('write') ?? false;
}

export function getDefaultRef(
  repository: RepositoryView | undefined,
  branchPrefix: string,
  loadedFromRef?: string
): string {
  const canBranch = repository?.workflows?.includes('branch') ?? false;
  const { enforceTemplate, nameTemplate } = repository?.branchOptions ?? {};
  // An enforced name template only ever names a new branch, so start on one; useBranchTemplate
  // replaces this placeholder with the rendered template. It wins over an explicit preview ref.
  if (canBranch && enforceTemplate && nameTemplate?.trim()) {
    return generateNewBranchName(branchPrefix);
  }
  // Opened from a branch preview: keep saving to that branch.
  if (canBranch && loadedFromRef && loadedFromRef !== repository?.branch) {
    return loadedFromRef;
  }
  // The repository lists its preferred workflow first; branch-first repositories start on a new branch.
  if (repository?.workflows?.[0] === 'branch') {
    return generateNewBranchName(branchPrefix);
  }
  return repository?.branch ?? '';
}
