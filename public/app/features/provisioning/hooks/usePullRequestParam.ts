import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');
  const newPrParam = params.get('new_pull_request_url');
  const repoUrl = params.get('repo_url');
  const repoType = params.get('repo_type');

  return {
    prURL: prParam ? textUtil.sanitizeUrl(prParam) : undefined,
    newPrURL: newPrParam ? textUtil.sanitizeUrl(newPrParam) : undefined,
    repoURL: repoUrl ? textUtil.sanitizeUrl(repoUrl) : undefined,
    repoType: repoType ? textUtil.sanitizeUrl(repoType) : undefined,
  };
};
