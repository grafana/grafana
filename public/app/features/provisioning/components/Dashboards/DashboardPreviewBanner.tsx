import { useEffect } from 'react';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types/dashboard';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { type PreviewBranchInfo, PreviewBannerViewPR } from '../Shared/PreviewBannerViewPR';

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

  // The version currently saved in Grafana, if the dashboard already exists on the configured branch
  const existingUid = file.data?.resource?.existing?.metadata?.name;

  useEffect(() => {
    // The scene cache has no TTL and is keyed by uid, so it can still be holding the scene from
    // before this branch was previewed/merged. Evict it so following the link below (or any other
    // navigation back to /d/<uid>) always fetches and renders the latest saved dashboard.
    if (existingUid) {
      getDashboardScenePageStateManager().removeSceneCache(existingUid);
    }
  }, [existingUid]);

  // Wait for the dry-run to resolve before rendering. resource.action drives the title, so showing
  // the banner mid-load would flash the "created" default and then flip to the real action.
  if (file.isLoading) {
    return null;
  }

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
  // Authoritative change type from the dry-run, so the banner title reflects the real action
  // (create/update/delete/move) instead of inferring "new resource" from the absence of a PR URL.
  const resourceAction = file.data?.resource?.action;

  const branchInfo: PreviewBranchInfo = {
    targetBranch: targetRef,
    configuredBranch: repository?.branch,
    repoBaseUrl,
  };

  // assureBaseUrl so the href still resolves under a configured appSubUrl, since opening the link
  // in a new tab bypasses the router and hits the URL directly.
  const originalUrl =
    typeof existingUid === 'string' && existingUid ? locationUtil.assureBaseUrl(`/d/${existingUid}`) : undefined;

  return (
    <PreviewBannerViewPR
      prURL={prURL}
      isNewPr={!hasExistingPr}
      action={resourceAction}
      branchInfo={branchInfo}
      originalUrl={originalUrl}
    />
  );
}

export function DashboardPreviewBanner({ queryParams, route, slug, path }: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.provisioningEnabled;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} />;
}
