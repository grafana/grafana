import { type provisioning } from '@grafana/runtime';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

/**
 * EXPOSED COMPONENT: grafana/provisioning/pull-request-banner/v1
 *
 * Props are `provisioning.PullRequestBannerProps` from `@grafana/runtime`, the data that the save
 * drawer passes to `onBranchSuccess`.
 */
export function PullRequestBannerExposedComponent({
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
