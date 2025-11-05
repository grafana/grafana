import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Icon, Stack, TextLink } from '@grafana/ui';
import { RepoTypeDisplay, RepoType } from 'app/features/provisioning/Wizard/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { commonAlertProps } from '../Dashboards/DashboardPreviewBanner';
import { getBranchUrl } from '../utils/url';

interface Props {
  prParam?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
  branchInfo?: PreviewBranchInfo;
}

export type PreviewBranchInfo = {
  targetBranch?: string;
  configuredBranch?: string;
  repoBaseUrl?: string;
};

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created or loaded from a new branch in repo.
 */
export function PreviewBannerViewPR({ prParam, isNewPr, behindBranch, repoUrl, branchInfo }: Props) {
  const { repoType } = usePullRequestParam();
  const { targetBranch, configuredBranch, repoBaseUrl } = branchInfo || {};

  const capitalizedRepoType = isValidRepoType(repoType) ? RepoTypeDisplay[repoType] : 'repository';

  const titleText = isNewPr
    ? t(
        'provisioned-resource-preview-banner.title-created-branch-in-repo',
        'A new resource has been created in a branch in {{repoType}}.',
        {
          repoType: capitalizedRepoType,
        }
      )
    : t(
        'provisioned-resource-preview-banner.title-loaded-pull-request-in-repo',
        'This resource is loaded from the branch you just created in {{repoType}} and it is only visible to you',
        {
          repoType: capitalizedRepoType,
        }
      );

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
      title={titleText}
      buttonContent={
        <Stack alignItems="center">
          {isNewPr
            ? t(
                'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-repo',
                'Open pull request in {{repoType}}',
                { repoType: capitalizedRepoType }
              )
            : t(
                'provisioned-resource-preview-banner.preview-banner.view-pull-request-in-repo',
                'View pull request in {{repoType}}',
                { repoType: capitalizedRepoType }
              )}
          <Icon name="external-link-alt" />
        </Stack>
      }
      onRemove={prParam ? () => window.open(textUtil.sanitizeUrl(prParam), '_blank') : undefined}
    >
      <Trans i18nKey="provisioned-resource-preview-banner.preview-banner.not-saved">
        The rest of Grafana users in your organization will still see the current version saved to configured default
        branch until this branch is merged
      </Trans>

      {/* when repo type is not local, we show branch information */}
      {showBranchInfo(repoType, branchInfo) && (
        <Box marginTop={1}>
          <Trans i18nKey="provisioned-resource-preview-banner.preview-banner.branch-text">branch: </Trans>
          <TextLink href={getBranchUrl(repoBaseUrl!, targetBranch!, repoType)}>{targetBranch}</TextLink> {'\u2192'}{' '}
          <TextLink href={getBranchUrl(repoBaseUrl!, configuredBranch!, repoType)}>{configuredBranch}</TextLink>
        </Box>
      )}
    </Alert>
  );
}

export function isValidRepoType(repoType: string | undefined): repoType is RepoType {
  if (typeof repoType !== 'string') {
    return false;
  }
  return repoType in RepoTypeDisplay;
}

function showBranchInfo(repoType: string | undefined, branchInfo?: PreviewBranchInfo): boolean {
  const { targetBranch, configuredBranch, repoBaseUrl } = branchInfo || {};
  return repoType !== 'local' && !!targetBranch && !!configuredBranch && !!repoBaseUrl;
}
