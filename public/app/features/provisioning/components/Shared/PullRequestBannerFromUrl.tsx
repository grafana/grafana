import { useUrlParams } from 'app/core/navigation/hooks';

import { usePullRequestParam } from '../../hooks/usePullRequestParam';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

export function PullRequestBannerFromUrl() {
  const { prURL, newPrURL, repoURL } = usePullRequestParam();
  const [urlParams] = useUrlParams();
  const branchInfo = {
    targetBranch: urlParams.get('ref') || undefined,
    configuredBranch: urlParams.get('repo_branch') || undefined,
    repoBaseUrl: repoURL,
  };
  return (
    <PreviewBannerViewPR
      prURL={newPrURL ?? prURL}
      isNewPr={Boolean(newPrURL)}
      repoUrl={repoURL}
      branchInfo={branchInfo}
    />
  );
}
