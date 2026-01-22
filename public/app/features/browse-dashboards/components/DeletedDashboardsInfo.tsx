import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

type DeleteTarget = 'folder' | 'dashboard';

interface DeletedDashboardsInfoProps {
  /** What is being deleted - determines prefix and suffix text */
  target: DeleteTarget;
}

function DeletedDashboardsCommonText() {
  return (
    <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-common">
      Deleted dashboards will be kept in the history for up to 12 months. Users with delete permissions can restore the
      dashboards they deleted, and admins can restore dashboards deleted by any user. The history is limited to 1000 dashboards
      — older ones may be removed sooner if the limit is reached.
    </Trans>
  );
}

export function DeletedDashboardsInfo({ target }: DeletedDashboardsInfoProps) {
  if (target === 'folder') {
    return (
      <Text element="p">
        <Trans i18nKey="browse-dashboards.action.delete-modal-restore-dashboards-prefix-folder">
          This action will delete the selected folders immediately.
        </Trans>{' '}
        <DeletedDashboardsCommonText />
        {' '}
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
