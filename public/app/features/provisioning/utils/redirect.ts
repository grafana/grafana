export type ResourceAction = 'create' | 'delete' | 'update';

type ResourceBranchUrlOptions = {
  baseUrl?: string;
  paramName?: string;
  paramValue?: string;
  repoType?: string;
  action?: ResourceAction;
};

export function buildResourceBranchRedirectUrl({
  baseUrl = '/dashboards',
  paramName,
  paramValue,
  repoType,
  action,
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

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
