import React, { FC, useState } from 'react';
import { css } from 'emotion';
import { Button, HorizontalGroup, Modal, stylesFactory, useTheme } from '@grafana/ui';
import { AppEvents, GrafanaTheme } from '@grafana/data';
import { FolderInfo } from 'app/types';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import appEvents from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSection, OnMoveItems } from '../types';
import { getCheckedDashboards } from '../utils';

interface Props {
  onMoveItems: OnMoveItems;
  results: DashboardSection[];
  isOpen: boolean;
  onDismiss: () => void;
}

export const MoveToFolderModal: FC<Props> = ({ results, onMoveItems, isOpen, onDismiss }) => {
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const theme = useTheme();
  const styles = getStyles(theme);
  const selectedDashboards = getCheckedDashboards(results);

  const moveTo = () => {
    if (folder && selectedDashboards.length) {
      const folderTitle = folder.title ?? 'General';

      backendSrv.moveDashboards(selectedDashboards.map(d => d.uid) as string[], folder).then((result: any) => {
        if (result.successCount > 0) {
          const ending = result.successCount === 1 ? '' : 's';
          const header = `Dashboard${ending} Moved`;
          const msg = `${result.successCount} dashboard${ending} moved to ${folderTitle}`;
          appEvents.emit(AppEvents.alertSuccess, [header, msg]);
        }

        if (result.totalCount === result.alreadyInFolderCount) {
          appEvents.emit(AppEvents.alertError, ['Error', `Dashboard already belongs to folder ${folderTitle}`]);
        } else {
          onMoveItems(selectedDashboards, folder);
        }

        onDismiss();
      });
    }
  };

  return isOpen ? (
    <Modal
      className={styles.modal}
      title="Choose Dashboard Folder"
      icon="folder-plus"
      isOpen={isOpen}
      onDismiss={onDismiss}
    >
      <>
        <div className={styles.content}>
          <p>
            Move the {selectedDashboards.length} selected dashboard{selectedDashboards.length === 1 ? '' : 's'} to the
            following folder:
          </p>
          <FolderPicker onChange={f => setFolder(f as FolderInfo)} useNewForms />
        </div>

        <HorizontalGroup justify="center">
          <Button variant="primary" onClick={moveTo}>
            Move
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </HorizontalGroup>
      </>
    </Modal>
  ) : null;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    modal: css`
      width: 500px;
    `,
    content: css`
      margin-bottom: ${theme.spacing.lg};
    `,
  };
});
