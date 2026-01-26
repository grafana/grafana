import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');
  const newPrParam = params.get('new_pull_request_url');
  const repoUrl = params.get('repo_url');
  const repoType = params.get('repo_type');

  return {
    prURL: prParam ? textUtil.sanitizeUrl(decodeURIComponent(prParam)) : undefined,
    newPrURL: newPrParam ? textUtil.sanitizeUrl(decodeURIComponent(newPrParam)) : undefined,
    repoURL: repoUrl ? textUtil.sanitizeUrl(decodeURIComponent(repoUrl)) : undefined,
    repoType: repoType ? textUtil.sanitizeUrl(decodeURIComponent(repoType)) : undefined,
  };
};
