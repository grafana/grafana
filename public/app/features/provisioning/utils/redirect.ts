type ResourceBranchUrlOptions = {
  baseUrl?: string;
  paramName?: string;
  paramValue?: string;
  repoType?: string;
};

export function buildResourceBranchRedirectUrl({
  baseUrl = '/dashboards',
  paramName,
  paramValue,
  repoType,
}: ResourceBranchUrlOptions): string {
  const params = new URLSearchParams();

  if (paramName && paramValue) {
    params.set(paramName, paramValue);
  }

  if (repoType) {
    params.set('repo_type', repoType);
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
