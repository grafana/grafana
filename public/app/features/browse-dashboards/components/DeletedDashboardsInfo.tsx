import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

type DeleteTarget = 'folder' | 'dashboard';

interface DeletedDashboardsInfoProps {
  /** What is being deleted - determines prefix and suffix text */
  target: DeleteTarget;
  /**
   * Only meaningful for target="folder": whether folder deletes cascade asynchronously in the
   * background rather than completing immediately. Swaps the prefix so it doesn't contradict the
   * fact that deletion may still be in progress after this modal closes.
   */
  cascadeAsync?: boolean;
}

function DeletedDashboardsCommonText() {
  return (
    <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-common">
      Deleted dashboards will be kept in the history for up to 12 months. Users with delete permissions can restore the
      dashboards they deleted, and admins can restore dashboards deleted by any user.
    </Trans>
  );
}

export function DeletedDashboardsInfo({ target, cascadeAsync }: DeletedDashboardsInfoProps) {
  if (target === 'folder') {
    return (
      <Text element="p">
        {cascadeAsync ? (
          <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-prefix-folder-async">
            This action will delete the selected folders and everything inside them. Deletion happens in the
            background, so it may take a moment to finish for folders with a lot of content.
          </Trans>
        ) : (
          <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-prefix-folder">
            This action will delete the selected folders immediately.
          </Trans>
        )}{' '}
        <DeletedDashboardsCommonText />{' '}
        <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-suffix-folder">
          Folders cannot be restored.
        </Trans>
      </Text>
    );
  }

  return (
    <Text element="p">
      <Trans i18nKey="dashboard-settings.delete-modal-restore-dashboards-prefix">
        This action will delete the dashboard.
      </Trans>{' '}
      <DeletedDashboardsCommonText />
    </Text>
  );
}
