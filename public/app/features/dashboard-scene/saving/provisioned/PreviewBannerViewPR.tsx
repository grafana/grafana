import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, Stack } from '@grafana/ui';
import { RepoTypeDisplay, RepoType } from 'app/features/provisioning/Wizard/types';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';

import { commonAlertProps } from './DashboardPreviewBanner';

// TODO: We have this https://github.com/grafana/git-ui-sync-project/issues/166 to add more details about the PR.

interface Props {
  prParam?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
}

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created or loaded from a new branch in repo.
 */
export function PreviewBannerViewPR({ prParam, isNewPr, behindBranch, repoUrl }: Props) {
  const { repoType } = usePullRequestParam();

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
    </Alert>
  );
}

export function isValidRepoType(repoType: string | undefined): repoType is RepoType {
  if (typeof repoType !== 'string') {
    return false;
  }
  return repoType in RepoTypeDisplay;
}
