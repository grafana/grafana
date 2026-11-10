import { PullRequestBanner, type PullRequestBannerBranchInfo, type PullRequestBannerProps } from '@grafana/ui';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

export type PreviewBranchInfo = PullRequestBannerBranchInfo;

export function PreviewBannerViewPR({ repoType, prTitle, action, ...props }: PullRequestBannerProps) {
  const params = usePullRequestParam();

  return (
    <PullRequestBanner
      {...props}
      repoType={repoType ?? params.repoType}
      prTitle={prTitle ?? params.prTitle}
      action={action ?? params.action}
    />
  );
}
