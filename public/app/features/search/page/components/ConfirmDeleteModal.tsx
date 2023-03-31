import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmModal, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { deleteFoldersAndDashboards } from 'app/features/manage-dashboards/state/actions';

import { OnMoveOrDeleleSelectedItems } from '../../types';

interface Props {
  onDeleteItems: OnMoveOrDeleleSelectedItems;
  results: Map<string, Set<string>>;
  onDismiss: () => void;
}

export const ConfirmDeleteModal = ({ results, onDeleteItems, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  const dashboards = Array.from(results.get('dashboard') ?? []);
  const folders = Array.from(results.get('folder') ?? []);

  const folderCount = folders.length;
  const dashCount = dashboards.length;

  let text = 'Do you want to delete the ';
  let subtitle;
  const dashEnding = dashCount === 1 ? '' : 's';
  const folderEnding = folderCount === 1 ? '' : 's';

  if (folderCount > 0 && dashCount > 0) {
    text += `selected folder${folderEnding} and dashboard${dashEnding}?\n`;
    subtitle = `All dashboards and alerts of the selected folder${folderEnding} will also be deleted`;
  } else if (folderCount > 0) {
    text += `selected folder${folderEnding} and all ${folderCount === 1 ? 'its' : 'their'} dashboards and alerts?`;
  } else {
    text += `${dashCount} selected dashboard${dashEnding}?`;
  }

  const deleteItems = () => {
    deleteFoldersAndDashboards(folders, dashboards).then(() => {
      onDeleteItems();
      onDismiss();
    });
  };

  const requireDoubleConfirm = config.featureToggles.nestedFolders && folderCount > 0;

  return (
    <ConfirmModal
      isOpen
      title="Delete"
      body={
        <>
          {text} {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </>
      }
      confirmText="Delete"
      confirmationText={requireDoubleConfirm ? 'delete' : undefined}
      onConfirm={deleteItems}
      onDismiss={onDismiss}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  subtitle: css`
    font-size: ${theme.typography.fontSize}px;
    padding-top: ${theme.spacing(2)};
  `,
});
