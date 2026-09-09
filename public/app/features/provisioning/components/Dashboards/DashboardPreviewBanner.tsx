import { useEffect } from 'react';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { type DashboardMeta, DashboardRoutes } from 'app/types/dashboard';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { type PreviewBranchInfo, PreviewBannerViewPR } from '../Shared/PreviewBannerViewPR';
import { isRefNotFoundError } from '../utils/errors';
import { splitSourcePath } from '../utils/path';

import { BranchGoneBanner } from './BranchGoneBanner';

export interface CommonBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  path?: string;
  slug?: string;
}

interface DashboardPreviewBannerProps extends CommonBannerProps {
  route?: string;
  dashboard: DashboardScene;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {
  dashboard: DashboardScene;
}

function DashboardPreviewBannerContent({ queryParams, slug, path, dashboard }: DashboardPreviewBannerContentProps) {
  const { prURL: existingPRUrl } = usePullRequestParam();
  // Refetch on focus so a branch deleted while the user was away (e.g. closing the PR in the
  // provider's tab) is noticed when they come back: the 404 below is the only signal it is gone.
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref }, { refetchOnFocus: true });
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

  // Authoritative change type from the dry-run, so the banner title reflects the real action
  // (create/update/delete/move) instead of inferring "new resource" from the absence of a PR URL.
  const resourceAction = file.data?.resource?.action;

  // RTK keeps the last good `data` after a failed refetch, so the recovery actions can still read the
  // dry-run result.
  if (file.isError && isRefNotFoundError(file.error, queryParams.ref)) {
    // The loader only records the ref when it actually loaded, so a match means the scene still holds
    // the branch's content; after a refresh it fell back to the saved version and there is no draft.
    const hasDraft = getLoadedRef(dashboard.state.meta) === queryParams.ref;
    return (
      <BranchGoneBanner
        dashboard={dashboard}
        existingUid={existingUid}
        // A dry-run "create" means the file was born on the deleted branch and never merged.
        draft={hasDraft ? { fileExistsOnConfiguredBranch: resourceAction !== 'create' } : undefined}
      />
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

// The ref the scene was actually loaded from, or undefined after the default-branch fallback. The
// loader records it as a `#ref` fragment on the sourcePath annotation (meta.provisioning is v1-only).
function getLoadedRef(meta: DashboardMeta): string | undefined {
  return splitSourcePath(meta.k8s?.annotations?.[AnnoKeySourcePath]).fragmentRef;
}

export function DashboardPreviewBanner({ queryParams, route, slug, path, dashboard }: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.provisioningEnabled;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return <DashboardPreviewBannerContent queryParams={queryParams} slug={slug} path={path} dashboard={dashboard} />;
}
