import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, HorizontalGroup, Modal, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { moveDashboards, moveFolders } from 'app/features/manage-dashboards/state/actions';
import { FolderInfo } from 'app/types';

import { GENERAL_FOLDER_UID } from '../../constants';
import { OnMoveOrDeleleSelectedItems } from '../../types';

interface Props {
  onMoveItems: OnMoveOrDeleleSelectedItems;
  results: Map<string, Set<string>>;
  onDismiss: () => void;
}

export const MoveToFolderModal = ({ results, onMoveItems, onDismiss }: Props) => {
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [moving, setMoving] = useState(false);

  const nestedFoldersEnabled = config.featureToggles.nestedFolders;

  const selectedDashboards = Array.from(results.get('dashboard') ?? []);
  const selectedFolders = nestedFoldersEnabled
    ? Array.from(results.get('folder') ?? []).filter((v) => v !== GENERAL_FOLDER_UID)
    : [];

  const handleFolderChange = useCallback(
    (newFolder: FolderInfo) => {
      setFolder(newFolder);
    },
    [setFolder]
  );

  const moveTo = async () => {
    if (!folder) {
      return;
    }

    if (nestedFoldersEnabled) {
      setMoving(true);
      let totalCount = 0;
      let successCount = 0;

      if (selectedDashboards.length) {
        const moveDashboardsResult = await moveDashboards(selectedDashboards, folder);

        totalCount += moveDashboardsResult.totalCount;
        successCount += moveDashboardsResult.successCount;
      }

      if (selectedFolders.length) {
        const moveFoldersResult = await moveFolders(selectedFolders, folder);

        totalCount += moveFoldersResult.totalCount;
        successCount += moveFoldersResult.successCount;
      }

      const destTitle = folder.title ?? 'General';
      notifyNestedMoveResult(notifyApp, destTitle, {
        selectedDashboardsCount: selectedDashboards.length,
        selectedFoldersCount: selectedFolders.length,
        totalCount,
        successCount,
      });

      onMoveItems();
      setMoving(false);
      onDismiss();

      return;
    }

    if (selectedDashboards.length) {
      const folderTitle = folder.title ?? 'General';
      setMoving(true);
      moveDashboards(selectedDashboards, folder).then((result) => {
        if (result.successCount > 0) {
          const ending = result.successCount === 1 ? '' : 's';
          const header = `Dashboard${ending} Moved`;
          const msg = `${result.successCount} dashboard${ending} moved to ${folderTitle}`;
          notifyApp.success(header, msg);
        }

        if (result.totalCount === result.alreadyInFolderCount) {
          notifyApp.error('Error', `Dashboard already belongs to folder ${folderTitle}`);
        } else {
          //update the list
          onMoveItems();
        }

        setMoving(false);
        onDismiss();
      });
    }
  };

  const thingsMoving = [
    ['folder', 'folders', selectedFolders.length] as const,
    ['dashboard', 'dashboards', selectedDashboards.length] as const,
  ]
    .filter(([single, plural, count]) => count > 0)
    .map(([single, plural, count]) => `${count.toLocaleString()} ${count === 1 ? single : plural}`)
    .join(' and ');

  return (
    <Modal
      isOpen
      className={styles.modal}
      title={nestedFoldersEnabled ? 'Move' : 'Choose Dashboard Folder'}
      icon="folder-plus"
      onDismiss={onDismiss}
    >
      <>
        <div className={styles.content}>
          {nestedFoldersEnabled && selectedFolders.length > 0 && (
            <Alert severity="warning" title=" Moving this item may change its permissions" />
          )}

          <p>Move {thingsMoving} to:</p>

          <FolderPicker allowEmpty={true} enableCreateNew={false} onChange={handleFolderChange} />
        </div>

        <HorizontalGroup justify="flex-end">
          <Button icon={moving ? 'fa fa-spinner' : undefined} variant="primary" onClick={moveTo}>
            Move
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </HorizontalGroup>
      </>
    </Modal>
  );
};

interface NotifyCounts {
  selectedDashboardsCount: number;
  selectedFoldersCount: number;
  totalCount: number;
  successCount: number;
}

function notifyNestedMoveResult(
  notifyApp: ReturnType<typeof useAppNotification>,
  destinationName: string,
  { selectedDashboardsCount, selectedFoldersCount, totalCount, successCount }: NotifyCounts
) {
  let objectMoving: string | undefined;
  const plural = successCount === 1 ? '' : 's';
  const failedCount = totalCount - successCount;

  if (selectedDashboardsCount && selectedFoldersCount) {
    objectMoving = `Item${plural}`;
  } else if (selectedDashboardsCount) {
    objectMoving = `Dashboard${plural}`;
  } else if (selectedFoldersCount) {
    objectMoving = `Folder${plural}`;
  }

  if (objectMoving) {
    const objectLower = objectMoving?.toLocaleLowerCase();

    if (totalCount === successCount) {
      notifyApp.success(`${objectMoving} moved`, `Moved ${successCount} ${objectLower} to ${destinationName}`);
    } else if (successCount === 0) {
      notifyApp.error(`Failed to move ${objectLower}`, `Could not move ${totalCount} ${objectLower} due to an error`);
    } else {
      notifyApp.warning(
        `Partially moved ${objectLower}`,
        `Failed to move ${failedCount} ${objectLower} to ${destinationName}`
      );
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css`
      width: 500px;
    `,
    content: css`
      margin-bottom: ${theme.spacing(3)};
    `,
  };
};
