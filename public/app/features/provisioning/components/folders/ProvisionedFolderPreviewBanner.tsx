import { config } from '@grafana/runtime';
import { CommonBannerProps } from 'app/features/provisioning/components/dashboards/DashboardPreviewBanner';
import { PreviewBannerViewPR } from 'app/features/provisioning/components/shared/PreviewBannerViewPR';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

export function ProvisionedFolderPreviewBanner({ queryParams }: CommonBannerProps) {
  const provisioningEnabled = config.featureToggles.provisioning;
  const { prURL, newPrURL, repoURL } = usePullRequestParam();

  if (!provisioningEnabled || 'kiosk' in queryParams) {
    return null;
  }

  if (prURL) {
    return <PreviewBannerViewPR prParam={prURL} />;
  }

  if (newPrURL) {
    return <PreviewBannerViewPR prParam={newPrURL} isNewPr />;
  }

  if (repoURL) {
    return <PreviewBannerViewPR repoUrl={repoURL} behindBranch />;
  }

  return null;
}
