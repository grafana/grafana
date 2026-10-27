import { type GetRepositoryRefsApiResponse, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';

/**
 * The backend's workflow for a target ref: an empty ref or the configured branch is a direct `write`;
 * any other branch, new or existing, is `branch`.
 */
export function getWorkflowForRef(repository: RepositoryView | undefined, ref: string | undefined): WorkflowOption {
  return !ref || ref === repository?.branch ? 'write' : 'branch';
}

/** The `ref` to send with a commit: omitted for a direct write so the backend targets the configured branch. */
export function getRequestRef(repository: RepositoryView | undefined, ref: string | undefined): string | undefined {
  return getWorkflowForRef(repository, ref) === 'write' ? undefined : ref;
}

/** Whether `ref` names a branch that already exists in the repository's listed refs. */
export function isKnownRef(refs: GetRepositoryRefsApiResponse | undefined, ref: string | undefined): boolean {
  return Boolean(ref) && Boolean(refs?.items?.some((item) => item.name === ref));
}
