import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, Stack } from '@grafana/ui';

import { commonAlertProps } from './DashboardPreviewBanner';

// TODO: We have this https://github.com/grafana/git-ui-sync-project/issues/166 to add more details about the PR.

interface Props {
  prParam?: string;
  isNewPr?: boolean;
  behindBranch?: boolean;
  repoUrl?: string;
}

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created or loaded from a new branch in Github.
 */
export function PreviewBannerViewPR({ prParam, isNewPr, behindBranch, repoUrl }: Props) {
  const titleText = isNewPr
    ? t(
        'provisioned-resource-preview-banner.title-created-branch-git-hub',
        'A new resource has been created in a branch in GitHub.'
      )
    : t(
        'provisioned-resource-preview-banner.title-loaded-pull-request-git-hub',
        'This resource is loaded from a pull request in GitHub.'
      );

  if (behindBranch) {
    return (
      <Alert
        {...commonAlertProps}
        buttonContent={
          <Stack alignItems="center">
            {t('provisioned-resource-preview-banner.preview-banner.open-git-hub', 'Open in Github')}
            <Icon name="external-link-alt" />
          </Stack>
        }
        title={t(
          'provisioned-resource-preview-banner.preview-banner.behind-branch',
          'This resource is behind the branch in GitHub.'
        )}
        onRemove={repoUrl ? () => window.open(textUtil.sanitizeUrl(repoUrl), '_blank') : undefined}
      >
        <Trans i18nKey="provisioned-resource-preview-banner.preview-banner.new-branch">
          View it in GitHub to see the latest changes.
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
                'provisioned-resource-preview-banner.preview-banner.open-pull-request-in-git-hub',
                'Open pull request in GitHub'
              )
            : t(
                'provisioned-resource-preview-banner.preview-banner.view-pull-request-in-git-hub',
                'View pull request in GitHub'
              )}
          <Icon name="external-link-alt" />
        </Stack>
      }
      onRemove={prParam ? () => window.open(textUtil.sanitizeUrl(prParam), '_blank') : undefined}
    >
      <Trans i18nKey="provisioned-resource-preview-banner.preview-banner.not-saved">
        The value is not yet saved in the Grafana database
      </Trans>
    </Alert>
  );
}
