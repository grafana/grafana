import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';

import { generateNewBranchName } from './utils/newBranchName';

export function getCanPushToConfiguredBranch(repository?: RepositoryView) {
  return repository?.workflows?.includes('write') ?? false;
}

/**
 * The backend's workflow for a target ref (IsWriteAllowed): an empty ref or the configured branch is
 * a direct `write`; any other branch, new or existing, is `branch`.
 */
export function getWorkflowForRef(repository: RepositoryView | undefined, ref: string | undefined): WorkflowOption {
  return !ref || ref === repository?.branch ? 'write' : 'branch';
}

/** The `ref` to send with a commit: omitted for a direct write so the backend targets the configured branch. */
export function getRequestRef(repository: RepositoryView | undefined, ref: string | undefined): string | undefined {
  return getWorkflowForRef(repository, ref) === 'write' ? undefined : ref;
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
