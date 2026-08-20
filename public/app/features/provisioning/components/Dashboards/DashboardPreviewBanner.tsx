import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useLazyGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Button, Modal } from '@grafana/ui';
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
  /** UID of the currently loaded scene, used to link back to the saved dashboard. */
  dashboardUid?: string;
  /**
   * Re-opens the save flow on the current scene so the user can commit their draft to a fresh
   * branch. Wired from the page (which holds the scene) so this component stays scene-agnostic.
   */
  onSaveToNewBranch?: () => void;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {
  dashboardUid?: string;
  onSaveToNewBranch?: () => void;
}

function DashboardPreviewBannerContent({
  queryParams,
  slug,
  path,
  dashboardUid,
  onSaveToNewBranch,
}: DashboardPreviewBannerContentProps) {
  const { prURL: existingPRUrl } = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });
  const [triggerRefs, { isFetching: isCheckingBranch }] = useLazyGetRepositoryRefsQuery();
  const [branchGone, setBranchGone] = useState(false);
  const navigate = useNavigate();

  // The version currently saved in Grafana, if the dashboard already exists on the configured branch
  const existingUid = file.data?.resource?.existing?.metadata?.name;
  // Prefer the saved-in-db uid; fall back to the loaded scene's uid (available after a refresh, when
  // the file query for the gone ref no longer returns the existing resource).
  const savedUid = existingUid ?? dashboardUid;

  // Leaves the (now meaningless) branch preview for the saved dashboard, discarding any in-memory draft.
  const goToSavedDashboard = useCallback(() => {
    navigate(savedUid ? `/d/${savedUid}` : '/dashboards');
  }, [navigate, savedUid]);

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

  // The preview ref could not be read (e.g. the branch was deleted). The scene loader has already
  // fallen back to the saved version, so instead of a broken preview banner point the user at it.
  // Only meaningful once the query has actually failed — not while it is still loading.
  if (queryParams.ref && file.isError) {
    return (
      <Alert
        severity="info"
        style={{ flex: 0 }}
        title={t('dashboard-scene.dashboard-preview-banner.branch-gone-title', 'This branch no longer exists')}
        action={
          <Button variant="primary" icon="arrow-left" onClick={goToSavedDashboard}>
            {t('dashboard-scene.dashboard-preview-banner.go-to-saved', 'Go to the saved dashboard')}
          </Button>
        }
      >
        {t(
          'dashboard-scene.dashboard-preview-banner.branch-gone-refresh-body',
          'The branch this preview was created on has been deleted. You are now viewing the saved version of this dashboard.'
        )}
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
      <Modal
        isOpen={branchGone}
        title={t('dashboard-scene.dashboard-preview-banner.branch-gone-title', 'This branch no longer exists')}
        onDismiss={() => setBranchGone(false)}
      >
        <p>
          {t(
            'dashboard-scene.dashboard-preview-banner.branch-gone-body',
            'The branch this preview was created on has been deleted, so the pull request can no longer be opened. Your changes only exist in this preview — save them to a new branch to keep them, or discard them and return to the saved version.'
          )}
        </p>
        <Modal.ButtonRow>
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => {
              setBranchGone(false);
              goToSavedDashboard();
            }}
          >
            {t('dashboard-scene.dashboard-preview-banner.branch-gone-discard', 'Discard changes')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setBranchGone(false);
              onSaveToNewBranch?.();
            }}
          >
            {t('dashboard-scene.dashboard-preview-banner.branch-gone-save', 'Save to a new branch')}
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

export function DashboardPreviewBanner({
  queryParams,
  route,
  slug,
  path,
  dashboardUid,
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
      dashboardUid={dashboardUid}
      onSaveToNewBranch={onSaveToNewBranch}
    />
  );
}
