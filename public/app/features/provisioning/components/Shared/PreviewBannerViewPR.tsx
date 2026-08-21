import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Icon, LinkButton, Stack, useStyles2 } from '@grafana/ui';
import { type ResourceObjects } from 'app/api/clients/provisioning/v0alpha1';
import { RepoTypeDisplay } from 'app/features/provisioning/Wizard/types';
import { isValidRepoType } from 'app/features/provisioning/guards';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { isGitProvider } from '../../utils/repositoryTypes';

import { BranchDisplay } from './BranchDisplay';

interface Props {
  /* PR url either from url param or BE response. It is used to open the pull request in a new tab. */
  prURL?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
  branchInfo?: PreviewBranchInfo;
  /**
   * Authoritative change type from the API dry-run (`resource.action`). When provided it selects
   * the banner copy; otherwise we fall back to the `action` URL param. Preferred over `isNewPr`
   * for the title, since `isNewPr` only reflects whether a PR URL was in the query, not the action.
   */
  action?: ResourceObjects['action'];
  /* URL of the version currently saved in Grafana, if the resource already exists. Offered as an action next to the pull request button. */
  originalUrl?: string;
}

export type PreviewBranchInfo = {
  targetBranch?: string;
  configuredBranch?: string;
  repoBaseUrl?: string;
};

const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created, deleted, or loaded from a new branch in repo.
 */
export function PreviewBannerViewPR({ prURL, isNewPr, behindBranch, repoUrl, branchInfo, action, originalUrl }: Props) {
  const styles = useStyles2(getStyles);
  const { repoType, action: paramAction, prTitle } = usePullRequestParam();

  const capitalizedRepoType = isValidRepoType(repoType) ? RepoTypeDisplay[repoType] : 'repository';
  // Prefill the provider's "open pull request" form title from pullRequest.titleTemplate; only the
  // PR/compare URL carries it. Returns prURL unchanged when no title was threaded through.
  const prLink = appendPullRequestTitleParam(prURL, repoType, prTitle);
  const linkUrl = prLink || branchInfo?.repoBaseUrl || repoUrl;

  const bannerAction = action ?? paramAction;
  const actionText = getBannerText(bannerAction, isNewPr, capitalizedRepoType);

  if (behindBranch) {
    return (
      <Alert
        {...commonAlertProps}
        title={t(
          'provisioned-resource-preview-banner.preview-banner.behind-branch-text',
          'This resource is behind the branch in {{repoType}}.',
          {
            repoType: capitalizedRepoType,
          }
        )}
        action={
          repoUrl && (
            <LinkButton href={repoUrl} target="_blank" variant="primary" icon="external-link-alt" iconPlacement="right">
              {t('provisioned-resource-preview-banner.preview-banner.open-in-repo-button', 'Open in {{repoType}}', {
                repoType: capitalizedRepoType,
              })}
            </LinkButton>
          )
        }
      >
        <Trans
          i18nKey="provisioned-resource-preview-banner.preview-banner.view-in-repo-button"
          values={{ repoType: capitalizedRepoType }}
        >
          View it in {{ repoType }} to see the latest changes.
        </Trans>
      </Alert>
    );
  }

  return (
    <Alert
      {...commonAlertProps}
      title={actionText.title}
      // Both actions are rendered here rather than through buttonContent/onRemove, because Alert
      // hardcodes buttonContent to variant="secondary" and the pull request is the primary action.
      // Links (not buttons with onClick) so either can be opened in a new tab to compare versions.
      action={
        <Stack alignItems="center" wrap="wrap">
          {originalUrl && (
            <LinkButton href={originalUrl} variant="secondary" icon="arrow-left">
              {t('provisioned-resource-preview-banner.preview-banner.view-saved-version', 'View saved version')}
            </LinkButton>
          )}
          {linkUrl && (
            <LinkButton href={linkUrl} target="_blank" variant="primary" icon="external-link-alt" iconPlacement="right">
              {actionText.button}
            </LinkButton>
          )}
        </Stack>
      }
    >
      {actionText.body}

      {/* when the repo type is a valid provider, we show branch information */}
      {showBranchInfo(repoType, branchInfo) && (
        <Box marginTop={1}>
          <span className={styles.branchRow}>
            {/* branch that changes pushed to */}
            <BranchDisplay
              baseUrl={branchInfo.repoBaseUrl}
              branch={branchInfo.targetBranch}
              repoType={repoType}
              dataTestId={selectors.pages.Provisioning.PreviewBanner.sourceBranchLink}
            />
            <Icon
              name="arrow-right"
              size="sm"
              className={styles.arrow}
              aria-label={t('provisioned-resource-preview-banner.preview-banner.branch-targets', 'targets')}
            />
            {/* Target branch (configured branch) */}
            <BranchDisplay
              baseUrl={branchInfo.repoBaseUrl}
              branch={branchInfo.configuredBranch}
              repoType={repoType}
              dataTestId={selectors.pages.Provisioning.PreviewBanner.targetBranchLink}
            />
          </span>
        </Box>
      )}
    </Alert>
  );
}

interface BannerText {
  title: string;
  body: string;
  button: string;
}

// title/body describe the action (create/update/delete/move); the button (Open vs View pull
// request) depends only on whether a PR already exists, so it's derived separately from isNewPr.
type BannerCopy = Omit<BannerText, 'button'>;

function getBannerText(action: string | undefined, isNewPr: boolean | undefined, repoType: string): BannerText {
  const copy = getBannerCopy(action, isNewPr, repoType);
  return { ...copy, button: getButtonText(isNewPr, repoType) };
}

function getBannerCopy(action: string | undefined, isNewPr: boolean | undefined, repoType: string): BannerCopy {
  switch (action) {
    case 'delete':
      return getDeleteBannerCopy(repoType);
    case 'update':
      return getUpdateBannerCopy(repoType);
    case 'move':
      return getMoveBannerCopy(repoType);
    default:
      return getCreateBannerCopy(isNewPr, repoType);
  }
}

function getButtonText(isNewPr: boolean | undefined, repoType: string): string {
  return isNewPr
    ? t(
        'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-repo',
        'Open pull request in {{repoType}}',
        {
          repoType,
        }
      )
    : t(
        'provisioned-resource-preview-banner.preview-banner.view-pull-request-in-repo',
        'View pull request in {{repoType}}',
        {
          repoType,
        }
      );
}

function getCreateBannerCopy(isNewPr: boolean | undefined, repoType: string): BannerCopy {
  return {
    title: isNewPr
      ? t(
          'provisioned-resource-preview-banner.title-created-branch-in-repo',
          'A new resource has been created in a branch in {{repoType}}.',
          { repoType }
        )
      : t(
          'provisioned-resource-preview-banner.title-loaded-pull-request-in-repo',
          'This resource is loaded from the branch you just created in {{repoType}} and it is only visible to you',
          { repoType }
        ),
    body: t(
      'provisioned-resource-preview-banner.preview-banner.not-saved',
      'The rest of Grafana users in your organization will still see the current version saved to configured default branch until this branch is merged'
    ),
  };
}

function getDeleteBannerCopy(repoType: string): BannerCopy {
  return {
    title: t(
      'provisioned-resource-preview-banner.title-deleted-resource-in-branch',
      'A resource has been deleted in a branch in {{repoType}}.',
      { repoType }
    ),
    body: t(
      'provisioned-resource-preview-banner.preview-banner.delete-from-branch',
      'The rest of Grafana users in your organization will still see this resource until this branch is merged'
    ),
  };
}

function getUpdateBannerCopy(repoType: string): BannerCopy {
  return {
    title: t(
      'provisioned-resource-preview-banner.title-updated-resource-in-branch',
      'A resource has been updated in a branch in {{repoType}}.',
      { repoType }
    ),
    body: t(
      'provisioned-resource-preview-banner.preview-banner.update-from-branch',
      'The rest of Grafana users in your organization will still see the current version until this branch is merged'
    ),
  };
}

function getMoveBannerCopy(repoType: string): BannerCopy {
  return {
    title: t(
      'provisioned-resource-preview-banner.title-moved-resource-in-branch',
      'A resource has been moved in a branch in {{repoType}}.',
      { repoType }
    ),
    body: t(
      'provisioned-resource-preview-banner.preview-banner.move-from-branch',
      'The rest of Grafana users in your organization will still see the current version until this branch is merged'
    ),
  };
}

function showBranchInfo(
  repoType: string | undefined,
  branchInfo?: PreviewBranchInfo
): branchInfo is Required<PreviewBranchInfo> {
  const { targetBranch, configuredBranch, repoBaseUrl } = branchInfo || {};

  if (isValidRepoType(repoType) && isGitProvider(repoType)) {
    return !!targetBranch && !!configuredBranch && !!repoBaseUrl;
  }

  return false;
}

const getStyles = (theme: GrafanaTheme2) => ({
  branchRow: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
  }),
  arrow: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
});
