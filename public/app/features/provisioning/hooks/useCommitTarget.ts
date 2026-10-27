import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars } from '../utils/branchName';
import { getWorkflowForRef } from '../utils/workflow';

import { useBranchStatus } from './useBranchStatus';
import { useBranchTemplate } from './useBranchTemplate';
import { usePullRequestTitle } from './usePullRequestTitle';

interface UseCommitTargetArgs {
  repository: RepositoryView | undefined;
  vars: BranchTemplateVars;
  /** Current value of the form's `ref` field. */
  ref: string;
  isRefDirty: boolean;
  /** Must not mark the field dirty, or the branch template's fill would read as a user edit. */
  setRef: (value: string) => void;
}

export interface CommitTarget {
  /** The backend's workflow for `ref`: a direct `write` to the configured branch, or a `branch` push. */
  workflow: WorkflowOption;
  /** The commit creates `ref`; the destination page shows the PR banner, so no success toast. */
  isNewBranch: boolean;
  /** The refs that classify `ref` are still loading; hold submission until they land. */
  isResolving: boolean;
  /** The repository's branch-name template is enforced, so the ref field renders read-only. */
  lockBranch: boolean;
  /** Rendered pull-request title for the PR a new branch opens; '' when none applies. */
  prTitle: string;
}

/**
 * Classifies the branch a provisioned form commits to and derives what follows from it: the
 * branch-name template fill/lock and the pull-request title.
 *
 * Takes plain values rather than the form object so it stays free of generics and type assertions.
 */
export function useCommitTarget({ repository, vars, ref, isRefDirty, setRef }: UseCommitTargetArgs): CommitTarget {
  const workflow = getWorkflowForRef(repository, ref);
  const { isNewBranch, isResolving } = useBranchStatus(repository, ref);
  const { locked: lockBranch } = useBranchTemplate({
    repository,
    vars,
    isNewBranch,
    value: ref,
    isDirty: isRefDirty,
    setBranch: setRef,
  });
  const { prTitle } = usePullRequestTitle({ repository, vars, isNewBranch });
  return { workflow, isNewBranch, isResolving, lockBranch, prTitle };
}
