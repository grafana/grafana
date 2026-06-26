type ResourceAction = 'create' | 'delete' | 'update';

type ResourceBranchUrlOptions = {
  baseUrl?: string;
  paramName?: string;
  paramValue?: string;
  repoType?: string;
  action?: ResourceAction;
  prTitle?: string;
  /** Target branch the change was pushed to, for the PR banner's branch display. */
  ref?: string;
  /** Repository's configured (default) branch, for the PR banner's branch display. */
  configuredBranch?: string;
  /** Repository base URL, for the PR banner's branch links (read back as `repo_url`). */
  repoUrl?: string;
};

export function buildResourceBranchRedirectUrl({
  baseUrl = '/dashboards',
  paramName,
  paramValue,
  repoType,
  action,
  prTitle,
  ref,
  configuredBranch,
  repoUrl,
}: ResourceBranchUrlOptions): string {
  const params = new URLSearchParams();

  if (paramName && paramValue) {
    params.set(paramName, paramValue);
  }

  if (repoType) {
    params.set('repo_type', repoType);
  }

  if (action) {
    params.set('action', action);
  }

  if (prTitle) {
    params.set('pr_title', prTitle);
  }

  if (ref) {
    params.set('ref', ref);
  }

  if (configuredBranch) {
    params.set('repo_branch', configuredBranch);
  }

  if (repoUrl) {
    params.set('repo_url', repoUrl);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
