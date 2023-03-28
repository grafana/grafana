import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, HorizontalGroup, Modal, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import config from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { moveDashboards, moveFolders } from 'app/features/manage-dashboards/state/actions';
import { FolderInfo } from 'app/types';

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
  const selectedFolders = nestedFoldersEnabled ? Array.from(results.get('folder') ?? []) : [];

  const moveTo = async () => {
    console.log({ folder, selectedDashboards, selectedFolders });

    if (!folder) {
      return;
    }

    if (nestedFoldersEnabled) {
      setMoving(true);

      if (selectedDashboards.length) {
        const moveDashboardsResult = await moveDashboards(selectedDashboards, folder);
        console.log({ moveDashboardsResult });
      }

      if (selectedFolders.length) {
        const moveFoldersResult = await moveFolders(selectedFolders, folder);
        console.log({ moveFoldersResult });
      }

      notifyApp.success('something might have happened successfully');

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

  return (
    <Modal className={styles.modal} title="Choose Dashboard Folder" icon="folder-plus" onDismiss={onDismiss}>
      <>
        <div className={styles.content}>
          {selectedFolders.length > 0 && (
            <>
              <Alert severity={'warning'} title="Careful!">
                Moving folders may change it and all {"it's children's"} permissions permissions
              </Alert>
              <p>
                Move the {selectedFolders.length} selected folder{selectedFolders.length === 1 ? '' : 's'} to the
                following folder:
              </p>
            </>
          )}
          {selectedDashboards.length > 0 && (
            <p>
              Move the {selectedDashboards.length} selected dashboard{selectedDashboards.length === 1 ? '' : 's'} to the
              following folder:
            </p>
          )}
          <FolderPicker allowEmpty={true} enableCreateNew={false} onChange={(f) => setFolder(f)} />
        </div>

        <HorizontalGroup justify="center">
          <Button icon={moving ? 'fa fa-spinner' : undefined} disabled={!folder} variant="primary" onClick={moveTo}>
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
