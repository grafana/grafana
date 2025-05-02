import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');

  if (!prParam) {
    return undefined;
  }

  return textUtil.sanitizeUrl(decodeURIComponent(prParam));
};
