import { config } from '@grafana/runtime';
import { CommonBannerProps } from 'app/features/dashboard-scene/saving/provisioned/DashboardPreviewBanner';
import { PreviewBannerViewPR } from 'app/features/dashboard-scene/saving/provisioned/PreviewBannerViewPR';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

export function ProvisionedFolderPreviewBanner({ queryParams }: CommonBannerProps) {
  const provisioningEnabled = config.featureToggles.provisioning;
  const { prURL, newPrURL } = usePullRequestParam();

  if (!provisioningEnabled || 'kiosk' in queryParams) {
    return null;
  }

  if (prURL) {
    return <PreviewBannerViewPR prParam={prURL} />;
  }

  if (newPrURL) {
    return <PreviewBannerViewPR prParam={newPrURL} isNewPr />;
  }

  return null;
}
