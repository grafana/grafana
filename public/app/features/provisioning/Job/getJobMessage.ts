import { JobStatus } from 'app/api/clients/provisioning/v0alpha1';

export interface JobMessages {
  error?: string[];
  warning?: string[];
}

/**
 * Extracts error and warning message arrays from a job status.
 * Returns both separately so callers can render them as distinct alerts.
 * Falls back to the generic `message` field based on state.
 */
export function getJobMessages(status: Partial<JobStatus>): JobMessages {
  const { state, errors, warnings, message } = status;
  const result: JobMessages = {};

  if (errors?.length) {
    result.error = errors;
  } else if (state === 'error' && message) {
    result.error = [message];
  }

  if (warnings?.length) {
    result.warning = warnings;
  } else if (state === 'warning' && message) {
    result.warning = [message];
  }

  return result;
}
