import { textUtil } from '@grafana/data';
import { useUrlParams } from 'app/core/navigation/hooks';

import { isValidRepoType } from '../guards';

const K8S_NAME_RE = /^[a-z0-9][a-z0-9-]{0,252}$/;

export const usePullRequestParam = () => {
  const [params] = useUrlParams();
  const prParam = params.get('pull_request_url');
  const newPrParam = params.get('new_pull_request_url');
  const repoUrl = params.get('repo_url');
  const repoType = params.get('repo_type');
  const resourcePushedTo = params.get('resource_pushed_to');
  const actionParam = params.get('action');
  const prTitleParam = params.get('pr_title');
  const decodedRepoType = repoType ? decodeURIComponent(repoType) : undefined;
  const decodedResourcePushedTo = resourcePushedTo ? decodeURIComponent(resourcePushedTo) : undefined;

  return {
    prURL: prParam ? textUtil.sanitizeUrl(decodeURIComponent(prParam)) : undefined,
    newPrURL: newPrParam ? textUtil.sanitizeUrl(decodeURIComponent(newPrParam)) : undefined,
    repoURL: repoUrl ? textUtil.sanitizeUrl(decodeURIComponent(repoUrl)) : undefined,
    repoType: isValidRepoType(decodedRepoType) ? decodedRepoType : undefined,
    resourcePushedTo:
      decodedResourcePushedTo && K8S_NAME_RE.test(decodedResourcePushedTo) ? decodedResourcePushedTo : undefined,
    action: actionParam === 'create' || actionParam === 'delete' || actionParam === 'update' ? actionParam : undefined,
    // useUrlParams reads via URLSearchParams.get, which already percent-decodes; re-sanitize the
    // single-line shape defensively in case the param was hand-crafted in the URL.
    prTitle: prTitleParam ? prTitleParam.replace(/\s+/g, ' ').trim().slice(0, 255) : undefined,
  };
};
