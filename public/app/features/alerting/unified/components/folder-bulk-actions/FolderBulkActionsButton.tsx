import { Dropdown, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';

import { alertingFolderActionsApi } from '../../api/alertingFolderActionsApi';
import { FolderAction, useFolderAbility } from '../../hooks/useAbilities';

import { FolderActionMenuItem } from './MenuItemPauseFolder';
interface Props {
  folderUID: string;
}

export const FolderBukActionsButton = ({ folderUID }: Props) => {
  const [pauseSupported, pauseAllowed] = useFolderAbility(FolderAction.Pause);
  const canPause = pauseSupported && pauseAllowed;
  const [pauseFolder, updateState] = alertingFolderActionsApi.endpoints.pauseFolder.useMutation();
  const [unpauseFolder, unpauseState] = alertingFolderActionsApi.endpoints.unpauseFolder.useMutation();

  // const onDelete = async () => {
  //   //todo: delete folder endpoint??
  // };
  const showDeleteModal = () => {
    // appEvents.publish(
    //   new ShowModalReactEvent({
    //     component: DeleteModal,
    //     props: {
    //       selectedItems: {
    //         folder: { [folderUID]: true },
    //         dashboard: {},
    //         panel: {},
    //         $all: false,
    //       },
    //       onConfirm: onDelete,
    //     },
    //   })
    // );
  };

  const menuItems = (
    <>
      {canPause && (
        <>
          <FolderActionMenuItem
            folderUID={folderUID}
            label={t('alerting.folder-bulk-actions.pause.button.label', 'Pause evaluation')}
            icon="pause"
            executeAction={async (folderUID) => {
              await pauseFolder({ folderUID }).unwrap();
            }}
            isLoading={updateState.isLoading}
          />
          <FolderActionMenuItem
            folderUID={folderUID}
            label={t('alerting.folder-bulk-actions.pause.button.label', 'Unpause evaluation')}
            icon="play"
            executeAction={async (folderUID) => {
              await unpauseFolder({ folderUID }).unwrap();
            }}
            isLoading={unpauseState.isLoading}
          />
          {/* TODO: delete folder */}
          {/* <Menu.Item
            label={t('alerting.folder-bulk-actions.delete.button.label', 'Delete folder')}
            icon='trash-alt'
            onClick={showDeleteModal}
          /> */}
        </>
      )}
    </>
  );

  return (
    <Dropdown overlay={<Menu>{menuItems}</Menu>}>
      <MoreButton size="sm" title={t('alerting.folder-bulk-actions.more-button.title', 'Folder Actions')} />
    </Dropdown>
  );
};
