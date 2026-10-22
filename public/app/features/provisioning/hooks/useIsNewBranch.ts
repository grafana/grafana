import { skipToken } from '@reduxjs/toolkit/query/react';

import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isGitProvider } from '../utils/repositoryTypes';
import { getWorkflowForRef, isKnownRef } from '../utils/workflow';

/**
 * Whether committing to `ref` creates the branch: the refs have loaded and it is neither the
 * configured branch nor a known remote ref. False while the refs load or when the request failed,
 * so nothing acts on an unconfirmed ref (the branch template would otherwise overwrite an existing
 * branch).
 */
export function useIsNewBranch(repository: RepositoryView | undefined, ref: string | undefined): boolean {
  const queryArg = repository?.name && isGitProvider(repository.type) ? { name: repository.name } : skipToken;
  // `currentData` belongs to this repository; `data` would keep the previous repository's refs
  // while a newly selected one loads and classify the branch against the wrong list.
  const { currentData } = useGetRepositoryRefsQuery(queryArg);
  if (queryArg === skipToken || !currentData || getWorkflowForRef(repository, ref) === 'write') {
    return false;
  }
  return !isKnownRef(currentData, ref);
}
