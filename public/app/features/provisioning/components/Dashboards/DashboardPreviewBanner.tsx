import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types/dashboard';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { PreviewBranchInfo, PreviewBannerViewPR } from '../Shared/PreviewBannerViewPR';

export interface CommonBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  path?: string;
  slug?: string;
}

interface DashboardPreviewBannerProps extends CommonBannerProps {
  route?: string;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {}

export const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

function DashboardPreviewBannerContent({ queryParams, slug, path }: DashboardPreviewBannerContentProps) {
  const { prURL } = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });
  const targetRef = file.data?.ref;
  const repoBaseUrl = file.data?.urls?.repositoryURL;

  const branchInfo: PreviewBranchInfo = {
    targetBranch: targetRef,
    configuredBranch: repository?.branch,
    repoBaseUrl,
  };

  if (file.data?.errors) {
    return (
      <Alert
        title={t('dashboard-scene.dashboard-preview-banner.title-error-loading-dashboard', 'Error loading dashboard')}
        severity="error"
        style={{ flex: 0 }}
      >
        {file.data.errors.map((error, index) => (
          <div key={index}>{error}</div>
        ))}
      </Alert>
    );
  }

  // This page was loaded with a `pull_request_url` in the URL
  if (prURL?.length) {
    return <PreviewBannerViewPR prParam={prURL} branchInfo={branchInfo} />;
  }

  // Check if pull request URLs are available from the repository file data
  const prOrCompareUrl = file.data?.urls?.newPullRequestURL ?? file.data?.urls?.compareURL;
  if (prOrCompareUrl) {
    return <PreviewBannerViewPR prParam={prOrCompareUrl} isNewPr branchInfo={branchInfo} />;
  }

  return (
    <Alert
      {...commonAlertProps}
      title={t(
        'dashboard-scene.dashboard-preview-banner.title-dashboard-loaded-external-repository',
        'This dashboard is loaded from an external repository'
      )}
    >
      <Trans i18nKey="dashboard-scene.dashboard-preview-banner.not-yet-saved">
        The value is not saved in the Grafana database
      </Trans>
    </Alert>
  );
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.featureToggles.provisioning;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} />;
}
