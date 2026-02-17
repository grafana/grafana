import { t } from '@grafana/i18n';
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

function DashboardPreviewBannerContent({ queryParams, slug, path }: DashboardPreviewBannerContentProps) {
  const { prURL: existingPRUrl } = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });

  // early return if there is an error loading dashboard file from repository
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

  // Vars
  const targetRef = file.data?.ref;
  const repoBaseUrl = file.data?.urls?.repositoryURL || repository?.url;
  const prOrCompareUrl = file.data?.urls?.newPullRequestURL || file.data?.urls?.compareURL; // Check if pull request URLs are available from the repository file data
  const prURL = existingPRUrl || prOrCompareUrl; // if PR URL is provided, use it, otherwise use BE response url
  const hasExistingPr = Boolean(existingPRUrl); // when existing PR URL is provided, it means the dashboard is loaded from a pull request

  const branchInfo: PreviewBranchInfo = {
    targetBranch: targetRef,
    configuredBranch: repository?.branch,
    repoBaseUrl,
  };

  return <PreviewBannerViewPR prURL={prURL} isNewPr={!hasExistingPr} branchInfo={branchInfo} />;
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.featureToggles.provisioning;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} />;
}
