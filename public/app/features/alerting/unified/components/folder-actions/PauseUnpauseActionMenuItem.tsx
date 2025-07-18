import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import {
  trackFolderBulkActionsPauseFail,
  trackFolderBulkActionsPauseSuccess,
  trackFolderBulkActionsUnpauseFail,
  trackFolderBulkActionsUnpauseSuccess,
} from '../../Analytics';
import { stringifyErrorLike } from '../../utils/misc';
interface Props {
  folderUID: string;
  action: 'pause' | 'unpause';
  executeAction: (folderUID: string) => Promise<void>;
  isLoading: boolean;
}
export function PauseUnpauseActionMenuItem({ folderUID, executeAction, isLoading, action }: Props) {
  const notifyApp = useAppNotification();

  const label =
    action === 'pause'
      ? t('alerting.folder-bulk-actions.pause.button.label', 'Pause all rules')
      : t('alerting.folder-bulk-actions.unpause.button.label', 'Resume all rules');
  const icon = action === 'pause' ? 'pause' : 'play';
  const trackActionSuccess =
    action === 'pause' ? trackFolderBulkActionsPauseSuccess : trackFolderBulkActionsUnpauseSuccess;
  const trackActionFail = action === 'pause' ? trackFolderBulkActionsPauseFail : trackFolderBulkActionsUnpauseFail;
  const onActionClick = async () => {
    try {
      await executeAction(folderUID);
      trackActionSuccess();
    } catch (error) {
      trackActionFail();
      notifyApp.error(
        t('alerting.folder-bulk-actions.error', 'Failed to execute action for folder: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
    }
  };

  return <Menu.Item label={label} icon={icon} disabled={isLoading} onClick={onActionClick} />;
}
