import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useLazyGetRepositoryRefsQuery } from '@grafana/api-clients/rtkq/provisioning/v0alpha1';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, ConfirmModal } from '@grafana/ui';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { type DashboardPageRouteSearchParams } from 'app/features/dashboard/containers/types';
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
  const navigate = useNavigate();
  const file = useGetRepositoryFilesWithPathQuery({ name: slug, path, ref: queryParams.ref });
  const { repository } = useGetResourceRepositoryView({ name: slug });
  const [triggerRefs, { isFetching: isCheckingBranch }] = useLazyGetRepositoryRefsQuery();
  const [branchGone, setBranchGone] = useState(false);

  // Vars
  const targetRef = file.data?.ref;
  // The dashboard as currently saved in Grafana (the configured-branch version). Absent when the
  // branch introduced a brand-new dashboard that was never merged — then there is no current
  // version to fall back to, so we don't offer that way out.
  const currentDashboardUid: string | undefined = file.data?.resource?.existing?.metadata?.name;
  const repoBaseUrl = file.data?.urls?.repositoryURL || repository?.url;
  const prOrCompareUrl = file.data?.urls?.newPullRequestURL || file.data?.urls?.compareURL; // Check if pull request URLs are available from the repository file data
  const prURL = existingPRUrl || prOrCompareUrl; // if PR URL is provided, use it, otherwise use BE response url
  const hasExistingPr = Boolean(existingPRUrl); // when existing PR URL is provided, it means the dashboard is loaded from a pull request

  // The button points at a "create pull request" compare link that is only valid while the branch
  // exists. Pre-flighting the branch is only worthwhile when we created it (a real PR link still
  // resolves after its branch is gone) and the provider exposes a refs listing.
  const canPreflightBranch = Boolean(
    !hasExistingPr && repository?.name && targetRef && repository?.type && isGitProvider(repository.type)
  );

  // Verify the branch still exists before following the link. If it is gone (e.g. the PR was closed
  // and its branch deleted), offer a way out instead of dumping the user at the repository root.
  const handleOpenPullRequest = useCallback(
    async (openDefault: () => void) => {
      if (!canPreflightBranch || !repository?.name || !targetRef) {
        openDefault();
        return;
      }

      try {
        const refs = await triggerRefs({ name: repository.name }).unwrap();
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
    [canPreflightBranch, repository?.name, targetRef, triggerRefs]
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

  const branchInfo: PreviewBranchInfo = {
    targetBranch: targetRef,
    configuredBranch: repository?.branch,
    repoBaseUrl,
  };

  return (
    <>
      <PreviewBannerViewPR
        prURL={prURL}
        isNewPr={!hasExistingPr}
        branchInfo={branchInfo}
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
        alternativeText={
          currentDashboardUid
            ? t('dashboard-scene.dashboard-preview-banner.branch-gone-view-current', 'View the current version')
            : undefined
        }
        dismissText={t('dashboard-scene.dashboard-preview-banner.branch-gone-cancel', 'Cancel')}
        onConfirm={() => {
          setBranchGone(false);
          onSaveToNewBranch?.();
        }}
        onAlternative={
          currentDashboardUid
            ? () => {
                setBranchGone(false);
                // Leave the branch preview for the live dashboard, which loads the configured-branch
                // version. A different route, so it reloads (dropping the preview ref in place would
                // not re-fetch the scene).
                navigate(`/d/${currentDashboardUid}`);
              }
            : undefined
        }
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
  const provisioningEnabled = config.featureToggles.provisioning;
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
