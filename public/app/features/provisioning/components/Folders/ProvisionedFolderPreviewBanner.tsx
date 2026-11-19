import { t, Trans } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { type CommonBannerProps } from 'app/features/provisioning/components/Dashboards/DashboardPreviewBanner';
import { PreviewBannerViewPR } from 'app/features/provisioning/components/Shared/PreviewBannerViewPR';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { getRepositoryOverviewUrl } from '../../utils/repository';

export function ProvisionedFolderPreviewBanner({ queryParams }: CommonBannerProps) {
  const provisioningEnabled = config.provisioningEnabled;
  const { prURL, newPrURL, repoURL, resourcePushedTo } = usePullRequestParam();

  if (!provisioningEnabled || 'kiosk' in queryParams) {
    return null;
  }

  if (prURL) {
    return <PreviewBannerViewPR prURL={prURL} />;
  }

  if (newPrURL) {
    return <PreviewBannerViewPR prURL={newPrURL} isNewPr />;
  }

  if (repoURL) {
    return <PreviewBannerViewPR repoUrl={repoURL} behindBranch />;
  }

  if (resourcePushedTo) {
    return (
      <Alert
        title={t('provisioned-folder-preview-banner.folder-pushed-to-repository', 'Folder pushed to repository')}
        severity="info"
        buttonContent={t('provisioned-folder-preview-banner.view-folder', 'View repository status')}
        onRemove={() => locationService.push(getRepositoryOverviewUrl(resourcePushedTo))}
      >
        <Trans i18nKey="provisioned-folder-preview-banner.sync-needed">
          The folder has been successfully pushed to the repository but is not yet available in Grafana. It will appear
          once changes are synced from the repository
        </Trans>
      </Alert>
    );
  }

  return null;
}
