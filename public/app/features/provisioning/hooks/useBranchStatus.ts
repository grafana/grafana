import { skipToken } from '@reduxjs/toolkit/query/react';

import { type RepositoryView, useGetRepositoryRefsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { isGitProvider } from '../utils/repositoryTypes';
import { getWorkflowForRef, isKnownRef } from '../utils/workflow';

export interface BranchStatus {
  /**
   * Committing to the ref creates the branch: the refs have loaded and it is neither the configured
   * branch nor a known remote ref.
   */
  isNewBranch: boolean;
  /**
   * The refs that decide `isNewBranch` are still loading, so the commit target is unknown. Forms
   * hold submission until this clears: the branch template, PR title and success toast all depend
   * on the answer.
   */
  isResolving: boolean;
}

const RESOLVED_WRITE: BranchStatus = { isNewBranch: false, isResolving: false };

/**
 * Classifies the branch a form commits to. A direct write to the configured branch needs no lookup.
 * A failed refs request stops resolving and treats the branch as existing, so the form stays usable.
 */
export function useBranchStatus(repository: RepositoryView | undefined, ref: string | undefined): BranchStatus {
  const queryArg = repository?.name && isGitProvider(repository.type) ? { name: repository.name } : skipToken;
  // `currentData` belongs to this repository; `data` would keep the previous repository's refs
  // while a newly selected one loads and classify the branch against the wrong list.
  const { currentData, isError } = useGetRepositoryRefsQuery(queryArg);
  if (queryArg === skipToken || getWorkflowForRef(repository, ref) === 'write') {
    return RESOLVED_WRITE;
  }
  if (!currentData) {
    return { isNewBranch: false, isResolving: !isError };
  }
  return { isNewBranch: !isKnownRef(currentData, ref), isResolving: false };
}
