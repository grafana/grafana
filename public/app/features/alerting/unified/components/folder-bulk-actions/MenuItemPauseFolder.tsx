import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';

import {
  trackFolderBulkActionsPauseFail,
  trackFolderBulkActionsPauseSuccess,
  trackFolderBulkActionsUnpauseFail,
  trackFolderBulkActionsUnpauseSuccess,
} from '../../Analytics';
import { stringifyErrorLike } from '../../utils/misc';
interface Props {
  folderUID: string;
  /**
   * Method invoked after the request to notify that the bulk action has been completed
   */
  onActionSucceed?: () => void;
  action: 'pause' | 'unpause';
  executeAction: (folderUID: string) => Promise<void>;
  isLoading: boolean;
}
export function FolderActionMenuItem({ folderUID, onActionSucceed, executeAction, isLoading, action }: Props) {
  const notifyApp = useAppNotification();
  const label =
    action === 'pause'
      ? t('alerting.folder-bulk-actions.pause.button.label', 'Pause evaluation')
      : t('alerting.folder-bulk-actions.unpause.button.label', 'Unpause evaluation');
  const icon = action === 'pause' ? 'pause' : 'play';
  const trackActioSuccess =
    action === 'pause' ? trackFolderBulkActionsPauseSuccess : trackFolderBulkActionsUnpauseSuccess;
  const trackActionFail = action === 'pause' ? trackFolderBulkActionsPauseFail : trackFolderBulkActionsUnpauseFail;
  const onActionClick = async () => {
    try {
      await executeAction(folderUID);
      trackActioSuccess();
    } catch (error) {
      trackActionFail();
      notifyApp.error(
        t('alerting.folder-bulk-actions.error', 'Failed to execute action: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
      return;
    }
    onActionSucceed?.();
  };

  return <Menu.Item label={label} icon={icon} disabled={isLoading} onClick={onActionClick} />;
}
