import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, isFetchError } from '@grafana/runtime';
import { Alert, Button, Modal } from '@grafana/ui';
import {
  useGetRepositoryFilesWithPathQuery,
  useLazyGetRepositoryRefsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
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
  /**
   * Abandons the in-memory draft on the current scene (exits edit mode / clears the dirty state) so
   * the unsaved-changes prompt doesn't block the subsequent navigation away. Scene-coupled, so it is
   * wired from the page.
   */
  onDiscardChanges?: () => void;
}

interface DashboardPreviewBannerContentProps extends Required<Omit<CommonBannerProps, 'route'>> {
  onSaveToNewBranch?: () => void;
  onDiscardChanges?: () => void;
}

function DashboardPreviewBannerContent({
  queryParams,
  slug,
  path,
  onSaveToNewBranch,
  onDiscardChanges,
}: DashboardPreviewBannerContentProps) {
  const { prURL: existingPRUrl } = usePullRequestParam();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });
  const [triggerRefs, { isFetching: isCheckingBranch }] = useLazyGetRepositoryRefsQuery();
  const [branchGone, setBranchGone] = useState(false);
  const navigate = useNavigate();

  // The version currently saved in Grafana, if the dashboard already exists on the configured branch
  const existingUid = file.data?.resource?.existing?.metadata?.name;

  // Leaves the branch preview for the saved dashboard, discarding any in-memory draft.
  const goToSavedDashboard = useCallback(() => {
    navigate(existingUid ? `/d/${existingUid}` : '/dashboards');
  }, [navigate, existingUid]);

  useEffect(() => {
    // The scene cache has no TTL and is keyed by uid, so it can still be holding the scene from
    // before this branch was previewed/merged. Evict it so following the link below (or any other
    // navigation back to /d/<uid>) always fetches and renders the latest saved dashboard.
    if (existingUid) {
      getDashboardScenePageStateManager().removeSceneCache(existingUid);
    }
  }, [existingUid]);

  // Verify the branch still exists before following the pull request link. Resolves whether the
  // banner should open the link: `false` means the branch is gone (e.g. the PR was closed and its
  // branch deleted) and the recovery modal takes over — no tab is opened at all, so the user never
  // sees a dead compare link or a placeholder-tab flash.
  const handleOpenPullRequest = useCallback(async (): Promise<boolean> => {
    const targetRef = file.data?.ref;
    const repoName = repository?.name;
    if (!repoName || !targetRef) {
      return true;
    }

    try {
      const refs = await triggerRefs({ name: repoName }).unwrap();
      // An empty refs list means the check failed (a healthy repo always has its configured
      // branch), so open anyway. Only a non-empty list missing our branch proves deletion.
      const items = refs.items ?? [];
      if (items.length === 0 || items.some((ref) => ref.name === targetRef)) {
        return true;
      }
      setBranchGone(true);
      return false;
    } catch {
      // Don't block the user on a failed check — fall back to opening the link.
      return true;
    }
  }, [file.data?.ref, repository?.name, triggerRefs]);

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

  // The preview ref is gone (404) — e.g. the page was refreshed after the branch was deleted. The
  // scene loader has already fallen back to and rendered the saved version, so this is purely
  // informational: surface a dismissible notice rather than a broken preview banner. A 404 is
  // required (matching the loader) so transient/auth errors aren't mislabelled as a deleted branch.
  const refGone = Boolean(queryParams.ref) && file.isError && isFetchError(file.error) && file.error.status === 404;
  if (refGone) {
    // Never fall through to the preview banner — the query has no data to render it from.
    return <BranchGoneNotice />;
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

  // The pull request button points at a "create pull request" compare link that is only valid while
  // the branch exists. Pre-flighting is only worthwhile when we created it (a real PR link still
  // resolves after its branch is gone) and the provider exposes a refs listing. It also requires the
  // branch workflow: without it the recovery modal offers a save-to-new-branch the repo can't do.
  const canPreflightBranch = Boolean(
    !hasExistingPr &&
      repository?.name &&
      targetRef &&
      repository?.type &&
      isGitProvider(repository.type) &&
      repository.workflows?.includes('branch')
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
        action={resourceAction}
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
              // Clear the scene's dirty state first, or the unsaved-changes prompt blocks the nav.
              onDiscardChanges?.();
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

// Shown when the page is loaded with a ref whose branch was deleted (e.g. after a refresh). The
// loader already shows the saved version, so this is just an explanation and can be dismissed.
function BranchGoneNotice() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <Alert
      severity="info"
      style={{ flex: 0 }}
      title={t('dashboard-scene.dashboard-preview-banner.branch-gone-title', 'This branch no longer exists')}
      onRemove={() => setDismissed(true)}
    >
      {t(
        'dashboard-scene.dashboard-preview-banner.branch-gone-refresh-body',
        'The branch this preview was created on has been deleted. You are now viewing the saved version of this dashboard.'
      )}
    </Alert>
  );
}

export function DashboardPreviewBanner({
  queryParams,
  route,
  slug,
  path,
  onSaveToNewBranch,
  onDiscardChanges,
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
      onDiscardChanges={onDiscardChanges}
    />
  );
}
