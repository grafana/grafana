import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t } from 'app/core/internationalization';

import { stringifyErrorLike } from '../../utils/misc';
interface Props {
  folderUID: string;
  /**
   * Method invoked after the request to notify that the bulk action has been completed
   */
  onActionSucceed?: () => void;
  label: string;
  icon: 'pause' | 'play' | 'trash-alt';
  executeAction: (folderUID: string) => Promise<void>;
  isLoading: boolean;
}
export function FolderActionMenuItem({ folderUID, onActionSucceed, label, icon, executeAction, isLoading }: Props) {
  const notifyApp = useAppNotification();

  const onPauseClick = async () => {
    try {
      await executeAction(folderUID);
    } catch (error) {
      notifyApp.error(
        t('alerting.folder-bulk-actions.error', 'Failed to execute action: {{error}}', {
          error: stringifyErrorLike(error),
        })
      );
      return;
    }
    onActionSucceed?.();
  };

  return <Menu.Item label={label} icon={icon} disabled={isLoading} onClick={onPauseClick} />;
}
