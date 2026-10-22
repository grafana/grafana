import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { type Job, type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { type JobSuccess } from '../Wizard/types';
import { type DeleteJobSpec, type MoveJobSpec } from '../components/BulkActions/useBulkActionJob';
import { getJobListRedirectUrl } from '../utils/redirect';

import { useLastBranch } from './useLastBranch';

type ResourceJobSpec = DeleteJobSpec | MoveJobSpec;

/**
 * A created job with the exact spec it was created from. Creating the job refetches the refs,
 * which can reclassify the branch and clear the live PR title, so completion reads this snapshot
 * instead of the form's current state.
 */
export interface SubmittedJob {
  job: Job;
  jobSpec: ResourceJobSpec;
  prTitle: string;
}

interface UseResourceJobArgs {
  repository: RepositoryView | undefined;
  /** Live PR title, snapshotted when the job is created; it is not part of the job spec. */
  prTitle: string;
  /** Resource-specific cleanup right before leaving the page. */
  onBeforeLeave?: () => void;
}

/** The spec carries a ref only for a branch push; a direct write targets the configured branch. */
function getRequestRef(jobSpec: ResourceJobSpec) {
  return jobSpec.action === 'delete' ? jobSpec.delete.ref : jobSpec.move.ref;
}

/**
 * Runs a single-resource delete or move as a job and owns what follows: the submission snapshot,
 * remembering the branch for the next form, and the redirect to the dashboard list once the job
 * finishes. `submit` rejects with the API error so the form can show it its own way.
 */
export function useResourceJob({ repository, prTitle, onBeforeLeave }: UseResourceJobArgs) {
  const [createJob, { isLoading: isCreating }] = useCreateRepositoryJobsMutation();
  const [submitted, setSubmitted] = useState<SubmittedJob>();
  const navigate = useNavigate();
  const { setLastBranch } = useLastBranch();

  const submit = async (jobSpec: ResourceJobSpec) => {
    if (!repository) {
      throw new Error('Cannot create a job without a repository');
    }
    const job = await createJob({ name: repository.name, jobSpec }).unwrap();
    setSubmitted({ job, jobSpec, prTitle });
  };

  const handleSuccess = useCallback(
    ({ urls }: JobSuccess) => {
      if (!submitted) {
        return;
      }
      const requestRef = getRequestRef(submitted.jobSpec);
      // Mirrors what the /files-based forms remember through useProvisionedRequestHandler.
      setLastBranch(repository?.name, requestRef ?? repository?.branch);
      onBeforeLeave?.();
      navigate(
        getJobListRedirectUrl({
          workflow: requestRef ? 'branch' : 'write',
          urls,
          repoType: repository?.type,
          // The list page has a banner for deletes; moves have none.
          action: submitted.jobSpec.action === 'delete' ? 'delete' : undefined,
          prTitle: submitted.prTitle,
        })
      );
    },
    [submitted, repository?.name, repository?.branch, repository?.type, onBeforeLeave, navigate, setLastBranch]
  );

  return { submitted, submit, isCreating, handleSuccess };
}
