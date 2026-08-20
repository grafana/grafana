import { useCallback, useEffect, useState } from 'react';

import { useLazyGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, ConfirmModal } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { DashboardRoutes } from 'app/types/dashboard';

import { useGetResourceRepositoryView } from '../../hooks/useGetResourceRepositoryView';
import { isGitProvider } from '../../utils/repositoryTypes';
import { type PreviewBranchInfo, PreviewBannerViewPR } from '../Shared/PreviewBannerViewPR';

export interface CommonBannerProps {
  queryParams: DashboardPageRouteSearchParams;
  path?: string;
  slug?: string;
}

interface DashboardPreviewBannerProps extends CommonBannerProps {
  route?: string;
  /**
   * Re-opens the save flow on the current scene so the user can commit their draft to a fresh
   * branch. Wired from the page (which holds the scene) so this component stays scene-agnostic.
   */
  onSaveToNewBranch?: () => void;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {
  onSaveToNewBranch?: () => void;
}

function DashboardPreviewBannerContent({
  queryParams,
  slug,
  path,
  onSaveToNewBranch,
}: DashboardPreviewBannerContentProps) {
  const { prURL: existingPRUrl } = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });
  const [triggerRefs, { isFetching: isCheckingBranch }] = useLazyGetRepositoryRefsQuery();
  const [branchGone, setBranchGone] = useState(false);

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

  // Verify the branch still exists before following the pull request link. If it is gone (e.g. the
  // PR was closed and its branch deleted), offer a way out instead of opening a dead compare link.
  const handleOpenPullRequest = useCallback(
    async (openDefault: () => void) => {
      const targetRef = file.data?.ref;
      const repoName = repository?.name;
      if (!repoName || !targetRef) {
        openDefault();
        return;
      }

      try {
        const refs = await triggerRefs({ name: repoName }).unwrap();
        if (refs.items?.some((ref) => ref.name === targetRef)) {
          openDefault();
        } else {
          setBranchGone(true);
        }
      } catch {
        // Don't block the user on a failed check — fall back to the original behavior.
        openDefault();
      }
    },
    [file.data?.ref, repository?.name, triggerRefs]
  );

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

  // The pull request button points at a "create pull request" compare link that is only valid while
  // the branch exists. Pre-flighting is only worthwhile when we created it (a real PR link still
  // resolves after its branch is gone) and the provider exposes a refs listing.
  const canPreflightBranch = Boolean(
    !hasExistingPr && repository?.name && targetRef && repository?.type && isGitProvider(repository.type)
  );

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
    <>
      <PreviewBannerViewPR
        prURL={prURL}
        isNewPr={!hasExistingPr}
        branchInfo={branchInfo}
        originalUrl={originalUrl}
        onOpenPullRequest={canPreflightBranch ? handleOpenPullRequest : undefined}
        isCheckingBranch={isCheckingBranch}
      />
      <ConfirmModal
        isOpen={branchGone}
        title={t('dashboard-scene.dashboard-preview-banner.branch-gone-title', 'This branch no longer exists')}
        body={t(
          'dashboard-scene.dashboard-preview-banner.branch-gone-body',
          'The branch this preview was created on could not be found in the repository. The pull request may have been closed and its branch deleted. Your changes are only visible in this preview.'
        )}
        confirmText={t('dashboard-scene.dashboard-preview-banner.branch-gone-save', 'Save to a new branch')}
        confirmVariant="primary"
        dismissText={t('dashboard-scene.dashboard-preview-banner.branch-gone-cancel', 'Cancel')}
        onConfirm={() => {
          setBranchGone(false);
          onSaveToNewBranch?.();
        }}
        onDismiss={() => setBranchGone(false)}
      />
    </>
  );
}

export function DashboardPreviewBanner({
  queryParams,
  route,
  slug,
  path,
  onSaveToNewBranch,
}: DashboardPreviewBannerProps) {
  const provisioningEnabled = config.provisioningEnabled;
  if (!provisioningEnabled || 'kiosk' in queryParams || !path || route !== DashboardRoutes.Provisioning || !slug) {
    return null;
  }

  return (
    <DashboardPreviewBannerContent
      queryParams={queryParams}
      slug={slug}
      path={path}
      onSaveToNewBranch={onSaveToNewBranch}
    />
  );
}
