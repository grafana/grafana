import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');
  const newPrParam = params.get('new_pull_request_url');
  const repoUrl = params.get('repo_url');
  const repoType = params.get('repo_type');
  const resourcePushedTo = params.get('resource_pushed_to');

  return {
    prURL: prParam ? textUtil.sanitizeUrl(decodeURIComponent(prParam)) : undefined,
    newPrURL: newPrParam ? textUtil.sanitizeUrl(decodeURIComponent(newPrParam)) : undefined,
    repoURL: repoUrl ? textUtil.sanitizeUrl(decodeURIComponent(repoUrl)) : undefined,
    repoType: repoType ? textUtil.sanitizeUrl(decodeURIComponent(repoType)) : undefined,
    // Repository name the resource was pushed to, used to link to its status overview page
    resourcePushedTo: resourcePushedTo ? textUtil.sanitizeUrl(decodeURIComponent(resourcePushedTo)) : undefined,
  };
};
