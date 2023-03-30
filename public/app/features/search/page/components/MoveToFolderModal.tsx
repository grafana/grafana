import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, Modal, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { useAppNotification } from 'app/core/copy/appNotification';
import { moveDashboards } from 'app/features/manage-dashboards/state/actions';
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
  const selectedDashboards = Array.from(results.get('dashboard') ?? []);
  const [moving, setMoving] = useState(false);

  const moveTo = () => {
    if (folder && selectedDashboards.length) {
      const folderTitle = folder.title ?? 'General';
      setMoving(true);
      moveDashboards(selectedDashboards, folder).then((result: any) => {
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
    <Modal
      className={styles.modal}
      title="Choose Dashboard Folder"
      icon="folder-plus"
      isOpen={true}
      onDismiss={onDismiss}
    >
      <>
        <div className={styles.content}>
          <p>
            Move the {selectedDashboards.length} selected dashboard{selectedDashboards.length === 1 ? '' : 's'} to the
            following folder:
          </p>
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
