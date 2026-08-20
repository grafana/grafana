import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, LinkButton, Stack, TextLink, Text } from '@grafana/ui';
import { RepoTypeDisplay } from 'app/features/provisioning/Wizard/types';
import { isValidRepoType } from 'app/features/provisioning/guards';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { appendPullRequestTitleParam } from '../../utils/pullRequestTitle';
import { isGitProvider } from '../../utils/repositoryTypes';
import { getBranchUrl } from '../utils/url';

interface Props {
  /* PR url either from url param or BE response. It is used to open the pull request in a new tab. */
  prURL?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
  branchInfo?: PreviewBranchInfo;
  /* URL of the version currently saved in Grafana, if the resource already exists. Offered as an action next to the pull request button. */
  originalUrl?: string;
  /**
   * Intercepts the pull request button instead of following its link directly. The button opens a
   * tab synchronously (within the click gesture, so it isn't blocked as a popup) and hands the caller
   * `open`/`cancel` to drive it after an async check — e.g. `open()` once a pre-flight branch check
   * passes, or `cancel()` plus a different path when the branch is gone. When set, the button becomes
   * a click handler rather than a plain link.
   */
  onOpenPullRequest?: (actions: PullRequestOpenActions) => void;
  /** Renders the pull request button in a "checking…" state while an async pre-flight runs. */
  isCheckingBranch?: boolean;
}

export type PreviewBranchInfo = {
  targetBranch?: string;
  configuredBranch?: string;
  repoBaseUrl?: string;
};

export interface PullRequestOpenActions {
  /** Navigate the pre-opened tab to the pull request URL. */
  open: () => void;
  /** Close the pre-opened tab (when the URL won't be opened after all). */
  cancel: () => void;
}

const commonAlertProps = {
  severity: 'info' as const,
  style: { flex: 0 } as const,
};

function BranchDisplay({ baseUrl, branch, repoType }: { baseUrl: string; branch: string; repoType?: string }) {
  const link = getBranchUrl(baseUrl, branch, repoType);

  if (link.length) {
    return (
      <TextLink href={link} external>
        {branch}
      </TextLink>
    );
  }

  return <Text color="info">{branch}</Text>;
}

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created, deleted, or loaded from a new branch in repo.
 */
export function PreviewBannerViewPR({
  prURL,
  isNewPr,
  behindBranch,
  repoUrl,
  branchInfo,
  originalUrl,
  onOpenPullRequest,
  isCheckingBranch,
}: Props) {
  const { repoType, action, prTitle } = usePullRequestParam();

  const capitalizedRepoType = isValidRepoType(repoType) ? RepoTypeDisplay[repoType] : 'repository';
  // Prefill the provider's "open pull request" form title from pullRequest.titleTemplate; only the
  // PR/compare URL carries it. Returns prURL unchanged when no title was threaded through.
  const prLink = appendPullRequestTitleParam(prURL, repoType, prTitle);
  // When the PR/compare link is unavailable (e.g. the branch was removed after the PR was closed),
  // fall back to the branch itself rather than the repo root, which is disorienting.
  const branchLink =
    branchInfo?.repoBaseUrl && branchInfo?.targetBranch
      ? getBranchUrl(branchInfo.repoBaseUrl, branchInfo.targetBranch, repoType)
      : '';
  const linkUrl = prLink || branchLink || branchInfo?.repoBaseUrl || repoUrl;

  const actionText =
    action === 'delete'
      ? getDeleteBannerText(capitalizedRepoType)
      : action === 'update'
        ? getUpdateBannerText(capitalizedRepoType)
        : getCreateBannerText(isNewPr, capitalizedRepoType);

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
          {linkUrl &&
            // When a caller needs to pre-flight before opening (e.g. verify the branch still exists),
            // the primary action is a click handler; otherwise it stays a plain link so it opens in a
            // new tab and cmd/middle-click work.
            (onOpenPullRequest ? (
              <Button
                variant="primary"
                icon="external-link-alt"
                onClick={() => {
                  // Open the tab synchronously within the click gesture so a slow pre-flight can't get
                  // the eventual navigation blocked as a popup; the caller then drives or closes it.
                  const pendingTab = window.open('about:blank', '_blank');
                  onOpenPullRequest({
                    open: () => {
                      const href = textUtil.sanitizeUrl(linkUrl);
                      if (pendingTab) {
                        pendingTab.location.href = href;
                      } else {
                        window.open(href, '_blank');
                      }
                    },
                    cancel: () => pendingTab?.close(),
                  });
                }}
              >
                {isCheckingBranch
                  ? t('provisioned-resource-preview-banner.preview-banner.checking-branch', 'Checking branch…')
                  : actionText.button}
              </Button>
            ) : (
              <LinkButton
                href={linkUrl}
                target="_blank"
                variant="primary"
                icon="external-link-alt"
                iconPlacement="right"
              >
                {actionText.button}
              </LinkButton>
            ))}
        </Stack>
      }
    >
      {actionText.body}

      {/* when the repo type is a valid provider, we show branch information */}
      {showBranchInfo(repoType, branchInfo) && (
        <Box marginTop={1}>
          <Trans i18nKey="provisioned-resource-preview-banner.preview-banner.branch-text">branch:</Trans>{' '}
          {/* branch that changes pushed to */}
          <BranchDisplay baseUrl={branchInfo.repoBaseUrl} branch={branchInfo.targetBranch} repoType={repoType} />
          {'\u2192'} {/* Target branch (configured branch) */}
          <BranchDisplay baseUrl={branchInfo.repoBaseUrl} branch={branchInfo.configuredBranch} repoType={repoType} />
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

function getCreateBannerText(isNewPr: boolean | undefined, repoType: string): BannerText {
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
    button: isNewPr
      ? t(
          'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-repo',
          'Open pull request in {{repoType}}',
          { repoType }
        )
      : t(
          'provisioned-resource-preview-banner.preview-banner.view-pull-request-in-repo',
          'View pull request in {{repoType}}',
          { repoType }
        ),
  };
}

function getDeleteBannerText(repoType: string): BannerText {
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
    button: t(
      'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-repo',
      'Open pull request in {{repoType}}',
      { repoType }
    ),
  };
}

function getUpdateBannerText(repoType: string): BannerText {
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
    button: t(
      'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-repo',
      'Open pull request in {{repoType}}',
      { repoType }
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
