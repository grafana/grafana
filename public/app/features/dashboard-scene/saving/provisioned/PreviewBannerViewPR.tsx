import { textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Icon, Stack } from '@grafana/ui';

import { commonAlertProps } from './DashboardPreviewBanner';

// TODO: We have this https://github.com/grafana/git-ui-sync-project/issues/166 to add more details about the PR.

/**
 * @description This component is used to display a banner when a provisioned dashboard/folder is created or loaded from a new branch in Github.
 */
export function PreviewBannerViewPR({
  prParam,
  isFolder = false,
  isNewPr,
}: {
  prParam: string;
  isFolder?: boolean;
  isNewPr?: boolean;
}) {
  const newPrText = isFolder
    ? 'A new folder has been created in a branch in GitHub.'
    : 'This dashboard is loaded from a branch in GitHub.';

  const openPrText = isFolder
    ? 'A new folder has been created in a pull request in GitHub.'
    : 'This dashboard is loaded from a pull request in GitHub.';

  const text = isNewPr ? newPrText : openPrText;
  const btnText = isNewPr ? 'Open pull request in GitHub' : 'View pull request in GitHub';

  return (
    <Alert
      {...commonAlertProps}
      title={t('provisioned-resource.preview-banner.title-dashboard-loaded-branch-git-hub', text)}
      buttonContent={
        <Stack alignItems="center">
          <Trans i18nKey="provisioned-resource.preview-banner.open-pull-request-in-git-hub">{btnText}</Trans>
          <Icon name="external-link-alt" />
        </Stack>
      }
      onRemove={() => window.open(textUtil.sanitizeUrl(prParam), '_blank')}
    >
      <Trans i18nKey="provisioned-resource.preview-banner.not-saved">
        The value is not yet saved in the Grafana database
      </Trans>
    </Alert>
  );
}
