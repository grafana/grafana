import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { type Job, type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { type JobSuccess } from '../Wizard/types';
import { type DeleteJobSpec, type MoveJobSpec } from '../components/BulkActions/useBulkActionJob';
import { getJobListRedirectUrl, type ResourceBranchAction } from '../utils/redirect';

import { type CommitTarget } from './useCommitTarget';
import { useLastBranch } from './useLastBranch';

/**
 * A created job with the commit target it was submitted for. Creating the job refetches the refs,
 * which can reclassify the branch as existing and clear the live PR title, so completion reads
 * this snapshot instead of the form's current state.
 */
export type SubmittedJob = Pick<CommitTarget, 'workflow' | 'prTitle'> & { job: Job; ref: string };

interface UseResourceJobArgs {
  repository: RepositoryView | undefined;
  /** Live commit target, snapshotted when the job is created. */
  target: Pick<CommitTarget, 'workflow' | 'prTitle'>;
  /** Current value of the form's `ref` field. */
  ref: string;
  /** PR-banner action for the list page; omitted for moves, which have none. */
  action?: ResourceBranchAction;
  /** Resource-specific cleanup right before leaving the page. */
  onBeforeLeave?: () => void;
}

/**
 * Runs a single-resource delete or move as a job and owns what follows: the submission snapshot,
 * remembering the branch for the next form, and the redirect to the dashboard list once the job
 * finishes. `submit` rejects with the API error so the form can show it its own way.
 */
export function useResourceJob({ repository, target, ref, action, onBeforeLeave }: UseResourceJobArgs) {
  const [createJob, { isLoading: isCreating }] = useCreateRepositoryJobsMutation();
  const [submitted, setSubmitted] = useState<SubmittedJob>();
  const navigate = useNavigate();
  const { setLastBranch } = useLastBranch();

  const submit = async (repositoryName: string, jobSpec: DeleteJobSpec | MoveJobSpec) => {
    const job = await createJob({ name: repositoryName, jobSpec }).unwrap();
    setSubmitted({ job, ref, workflow: target.workflow, prTitle: target.prTitle });
  };

  const handleSuccess = useCallback(
    ({ urls }: JobSuccess) => {
      if (!submitted) {
        return;
      }
      // The form's ref is the configured branch for a direct write, so this mirrors what the
      // /files-based forms remember through useProvisionedRequestHandler.
      setLastBranch(repository?.name, submitted.ref || repository?.branch);
      onBeforeLeave?.();
      navigate(
        getJobListRedirectUrl({
          workflow: submitted.workflow,
          urls,
          repoType: repository?.type,
          action,
          prTitle: submitted.prTitle,
        })
      );
    },
    [submitted, repository?.name, repository?.branch, repository?.type, action, onBeforeLeave, navigate, setLastBranch]
  );

  return { submitted, submit, isCreating, handleSuccess };
}
