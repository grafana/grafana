import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Icon, Stack, TextLink, Text } from '@grafana/ui';
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
  /**
   * Overrides the banner button's action. Receives `openDefault`, which opens the computed link in a
   * new tab; callers can defer to it (e.g. after a pre-flight branch-existence check passes) or take
   * a different path (e.g. offer a way out when the branch is gone).
   */
  onOpenPullRequest?: (openDefault: () => void) => void;
  /** Renders the button in a "checking…" state while an async pre-flight runs. */
  isCheckingBranch?: boolean;
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

  const openDefault = () => {
    if (linkUrl) {
      window.open(textUtil.sanitizeUrl(linkUrl), '_blank');
    }
  };
  const onPrimaryAction = onOpenPullRequest ? () => onOpenPullRequest(openDefault) : openDefault;

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
        buttonContent={
          <Stack alignItems="center">
            {t('provisioned-resource-preview-banner.preview-banner.open-in-repo-button', 'Open in {{repoType}}', {
              repoType: capitalizedRepoType,
            })}
            <Icon name="external-link-alt" />
          </Stack>
        }
        title={t(
          'provisioned-resource-preview-banner.preview-banner.behind-branch-text',
          'This resource is behind the branch in {{repoType}}.',
          {
            repoType: capitalizedRepoType,
          }
        )}
        onRemove={repoUrl ? () => window.open(textUtil.sanitizeUrl(repoUrl), '_blank') : undefined}
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
      buttonContent={
        <Stack alignItems="center">
          {isCheckingBranch
            ? t('provisioned-resource-preview-banner.preview-banner.checking-branch', 'Checking branch…')
            : actionText.button}
          <Icon name="external-link-alt" />
        </Stack>
      }
      onRemove={linkUrl ? onPrimaryAction : undefined}
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
          'Open a pull request in {{repoType}}',
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
      'Open a pull request in {{repoType}}',
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
      'Open a pull request in {{repoType}}',
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
