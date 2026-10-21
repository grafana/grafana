import { skipToken } from '@reduxjs/toolkit/query/react';

import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { getWorkflowForRef } from '../components/defaults';
import { isGitProvider } from '../utils/repositoryTypes';

/**
 * Whether committing to `ref` creates the branch: it is neither the configured branch nor a known
 * remote ref. `undefined` while the refs are still loading. A failed refs request reads as `false`,
 * so an unresolvable ref is never treated as new (the branch template would otherwise overwrite an
 * existing branch opened from a preview).
 */
export function useIsNewBranch(repository: RepositoryView | undefined, ref: string | undefined): boolean | undefined {
  const queryArg = repository?.name && isGitProvider(repository.type) ? { name: repository.name } : skipToken;
  const { data, isLoading, isUninitialized } = useGetRepositoryRefsQuery(queryArg);
  if (getWorkflowForRef(repository, ref) === 'write') {
    return false;
  }
  if (!data) {
    // The request only starts in a layout effect, so the first render is still uninitialized.
    return queryArg !== skipToken && (isLoading || isUninitialized) ? undefined : false;
  }
  return !data.items?.some((item) => item.name === ref);
}
