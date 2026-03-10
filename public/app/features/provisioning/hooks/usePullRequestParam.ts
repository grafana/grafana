import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

export type ResourceAction = 'create' | 'delete';

const RESOURCE_ACTIONS: readonly string[] = ['create', 'delete'] as const;

function isResourceAction(value: string | null): value is ResourceAction {
  return value !== null && RESOURCE_ACTIONS.includes(value);
}

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');
  const newPrParam = params.get('new_pull_request_url');
  const repoUrl = params.get('repo_url');
  const repoType = params.get('repo_type');
  const resourcePushedTo = params.get('resource_pushed_to');
  const actionParam = params.get('action');

  return {
    prURL: prParam ? textUtil.sanitizeUrl(decodeURIComponent(prParam)) : undefined,
    newPrURL: newPrParam ? textUtil.sanitizeUrl(decodeURIComponent(newPrParam)) : undefined,
    repoURL: repoUrl ? textUtil.sanitizeUrl(decodeURIComponent(repoUrl)) : undefined,
    repoType: repoType ? textUtil.sanitizeUrl(decodeURIComponent(repoType)) : undefined,
    // Repository name the resource was pushed to, used to link to its status overview page
    resourcePushedTo: resourcePushedTo ? textUtil.sanitizeUrl(decodeURIComponent(resourcePushedTo)) : undefined,
    action: isResourceAction(actionParam) ? actionParam : undefined,
  };
};
