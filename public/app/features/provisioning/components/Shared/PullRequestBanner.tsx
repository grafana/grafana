import { type provisioning } from '@grafana/runtime';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

/**
 * `provisioning.PullRequestBanner` in `@grafana/runtime`. Takes the data that the save drawer passes
 * to `onBranchSuccess`.
 */
export function PullRequestBanner({
  ref,
  pullRequestUrl,
  repositoryUrl,
  repoType,
  configuredBranch,
  action = 'create',
}: provisioning.PullRequestBannerProps) {
  return (
    <PreviewBannerViewPR
      prURL={pullRequestUrl}
      isNewPr
      repoUrl={repositoryUrl}
      repoType={repoType}
      action={action}
      branchInfo={{ targetBranch: ref, configuredBranch, repoBaseUrl: repositoryUrl }}
    />
  );
}
