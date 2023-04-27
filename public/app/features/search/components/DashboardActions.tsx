import React, { useMemo, useState } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, Button, Icon, HorizontalGroup } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { FolderDTO } from 'app/types';

import { MoveToFolderModal } from '../page/components/MoveToFolderModal';

export interface Props {
  folder: FolderDTO | undefined;
  canCreateFolders?: boolean;
  canCreateDashboards?: boolean;
}

export const DashboardActions = ({ folder, canCreateFolders = false, canCreateDashboards = false }: Props) => {
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const canMove = config.featureToggles.nestedFolders && (folder?.canSave ?? false);

  const moveSelection = useMemo(
    () => new Map<string, Set<string>>([['folder', new Set(folder?.uid ? [folder.uid] : [])]]),
    [folder]
  );

  const actionUrl = (type: string) => {
    let url = `dashboard/${type}`;
    const isTypeNewFolder = type === 'new_folder';

    if (isTypeNewFolder) {
      url = `dashboards/folder/new/`;
    }

    if (folder?.uid) {
      url += `?folderUid=${folder.uid}`;
    }

    return url;
  };

  const MenuActions = () => {
    return (
      <Menu>
        {canCreateDashboards && (
          <Menu.Item
            url={actionUrl('new')}
            label={t('search.dashboard-actions.new-dashboard', 'New Dashboard')}
            onClick={() =>
              reportInteraction('grafana_menu_item_clicked', { url: actionUrl('new'), from: '/dashboards' })
            }
          />
        )}
        {canCreateFolders && (config.featureToggles.nestedFolders || !folder?.uid) && (
          <Menu.Item
            url={actionUrl('new_folder')}
            label={t('search.dashboard-actions.new-folder', 'New Folder')}
            onClick={() =>
              reportInteraction('grafana_menu_item_clicked', { url: actionUrl('new_folder'), from: '/dashboards' })
            }
          />
        )}
        {canCreateDashboards && (
          <Menu.Item
            url={actionUrl('import')}
            label={t('search.dashboard-actions.import', 'Import')}
            onClick={() =>
              reportInteraction('grafana_menu_item_clicked', { url: actionUrl('import'), from: '/dashboards' })
            }
          />
        )}
      </Menu>
    );
  };

  return (
    <>
      <div>
        <HorizontalGroup>
          {canMove && (
            <Button onClick={() => setIsMoveModalOpen(true)} icon="exchange-alt" variant="secondary">
              Move
            </Button>
          )}
          <Dropdown overlay={MenuActions} placement="bottom-start">
            <Button variant="primary">
              {t('search.dashboard-actions.new', 'New')}
              <Icon name="angle-down" />
            </Button>
          </Dropdown>
        </HorizontalGroup>
      </div>

      {canMove && isMoveModalOpen && (
        <MoveToFolderModal onMoveItems={() => {}} results={moveSelection} onDismiss={() => setIsMoveModalOpen(false)} />
      )}
    </>
  );
};
