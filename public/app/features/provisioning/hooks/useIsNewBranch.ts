import { skipToken } from '@reduxjs/toolkit/query/react';

import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isGitProvider } from '../utils/repositoryTypes';
import { getWorkflowForRef } from '../utils/workflow';

/**
 * Whether committing to `ref` creates the branch: it is neither the configured branch nor a known
 * remote ref. `undefined` while the refs are loading or when the request failed, so callers never
 * act on an unresolved ref (the branch template would otherwise overwrite an existing branch, and
 * the folder picker would request an unborn one).
 */
export function useIsNewBranch(repository: RepositoryView | undefined, ref: string | undefined): boolean | undefined {
  const queryArg = repository?.name && isGitProvider(repository.type) ? { name: repository.name } : skipToken;
  // `currentData` belongs to this repository; `data` would keep the previous repository's refs
  // while a newly selected one loads and classify the branch against the wrong list.
  const { currentData } = useGetRepositoryRefsQuery(queryArg);
  if (queryArg === skipToken || getWorkflowForRef(repository, ref) === 'write') {
    return false;
  }
  if (!currentData) {
    return undefined;
  }
  return !currentData.items?.some((item) => item.name === ref);
}
