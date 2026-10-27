import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { type Job, type RepositoryView, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { type JobSuccess } from '../Wizard/types';
import { type ResourceJobSpec } from '../types/job';
import { getJobListRedirectUrl } from '../utils/redirect';

import { useLastBranch } from './useLastBranch';

/**
 * A created job with the exact spec it was created from. Creating the job refetches the refs,
 * which can reclassify the branch and clear the live PR title, so completion reads this snapshot
 * instead of the form's current state.
 */
export interface SubmittedJob {
  job: Job;
  jobSpec: ResourceJobSpec;
  prTitle?: string;
}

interface UseResourceJobArgs {
  repository: RepositoryView | undefined;
  /** Live PR title, snapshotted when the job is created; it is not part of the job spec. */
  prTitle?: string;
  /** Resource-specific cleanup right before leaving the page. */
  onBeforeLeave?: () => void;
}

/** The spec carries a ref only for a branch push; a direct write targets the configured branch. */
export function getJobRef(jobSpec: ResourceJobSpec) {
  return jobSpec.action === 'delete' ? jobSpec.delete.ref : jobSpec.move.ref;
}

/**
 * Creates a delete or move job and keeps the submission snapshot. `submit` rejects with the API
 * error so the form can show it its own way. Forms that leave the page once the job finishes use
 * `handleSuccess`, which remembers the branch for the next form and redirects to the dashboard list.
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

  const handleSuccess = ({ urls }: JobSuccess) => {
    if (!submitted) {
      return;
    }
    const requestRef = getJobRef(submitted.jobSpec);
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
  };

  return { submitted, submit, isCreating, handleSuccess };
}
