import { type JobResourceSummary, type JobStatus, type ResourceSyncIssue } from 'app/api/clients/provisioning/v0alpha1';

export interface JobMessages {
  error?: string[];
  warning?: string[];
}

export interface JobMessagesOptions {
  // Also read the per-resource issues from the job summary when the job has no top-level errors/warnings.
  includeResourceIssues?: boolean;
}

// resourceErrors/resourceWarnings are the categorized counterparts to the
// deprecated flat-string errors/warnings -- prefer them, but fall back for
// historic jobs recorded before this field existed.
export function getIssueMessages(issues: ResourceSyncIssue[] | undefined, fallback: string[] | undefined): string[] {
  if (issues?.length) {
    return issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message));
  }
  return fallback ?? [];
}

function getSummaryMessages(
  summary: Array<JobResourceSummary | undefined> | undefined,
  kind: 'error' | 'warning'
): string[] {
  return (summary ?? []).flatMap((item) => {
    if (!item) {
      return [];
    }
    return kind === 'error'
      ? getIssueMessages(item.resourceErrors, item.errors)
      : getIssueMessages(item.resourceWarnings, item.warnings);
  });
}

/**
 * Extracts error and warning message arrays from a job status.
 * Returns both separately so callers can render them as distinct alerts.
 * Falls back to the generic `message` field based on state.
 */
export function getJobMessages(status: Partial<JobStatus>, options: JobMessagesOptions = {}): JobMessages {
  const { state, errors, warnings, message, summary } = status;
  const result: JobMessages = {};

  const resourceErrors = options.includeResourceIssues ? getSummaryMessages(summary, 'error') : [];
  const resourceWarnings = options.includeResourceIssues ? getSummaryMessages(summary, 'warning') : [];

  if (errors?.length) {
    result.error = errors;
  } else if (resourceErrors.length) {
    result.error = resourceErrors;
  } else if (state === 'error' && message) {
    result.error = [message];
  }

  if (warnings?.length) {
    result.warning = warnings;
  } else if (resourceWarnings.length) {
    result.warning = resourceWarnings;
  } else if (state === 'warning' && message) {
    result.warning = [message];
  }

  return result;
}
