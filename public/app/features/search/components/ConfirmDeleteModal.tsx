import React, { Dispatch, FC } from 'react';
import { ConfirmModal, stylesFactory } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSection, SearchAction } from '../types';
import { getCheckedUids } from '../utils';
import { DELETE_ITEMS } from '../reducers/actionTypes';
import { css } from 'emotion';

interface Props {
  dispatch: Dispatch<SearchAction>;
  results: DashboardSection[];
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmDeleteModal: FC<Props> = ({ results, dispatch, isOpen, onClose }) => {
  const styles = getStyles();
  const uids = getCheckedUids(results);
  const { folders, dashboards } = uids;
  const folderCount = folders.length;
  const dashCount = dashboards.length;
  let text = 'Do you want to delete the ';
  let subtitle;
  const dashEnding = dashCount === 1 ? '' : 's';
  const folderEnding = folderCount === 1 ? '' : 's';

  if (folderCount > 0 && dashCount > 0) {
    text += `selected folder${folderEnding} and dashboard${dashEnding}?\n`;
    subtitle = `All dashboards of the selected folder${folderEnding} will also be deleted`;
  } else if (folderCount > 0) {
    text += `selected folder${folderEnding} and all its dashboards?`;
  } else {
    text += `selected dashboard${dashEnding}?`;
  }

  const deleteItems = () => {
    backendSrv.deleteFoldersAndDashboards(folders, dashboards).then(() => {
      onClose();
      // Redirect to /dashboard in case folder was deleted from f/:folder.uid
      getLocationSrv().update({ path: '/dashboards' });
      dispatch({ type: DELETE_ITEMS, payload: { folders, dashboards } });
    });
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Delete"
      body={
        <>
          {text} {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </>
      }
      confirmText="Delete"
      onConfirm={deleteItems}
      onDismiss={onClose}
    />
  );
};

const getStyles = stylesFactory(() => {
  return {
    subtitle: css`
      font-size: 14px;
      padding-top: 14px;
    `,
  };
});
