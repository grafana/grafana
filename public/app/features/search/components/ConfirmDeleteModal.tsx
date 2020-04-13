import React, { Dispatch, FC } from 'react';
import { ConfirmModal } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSection, SearchAction } from '../types';
import { getCheckedUids } from '../utils';
import { DELETE_ITEMS } from '../reducers/actionTypes';

interface Props {
  dispatch: Dispatch<SearchAction>;
  results: DashboardSection[];
  isOpen: boolean;
  onClose: () => void;
}

export const ConfirmDeleteModal: FC<Props> = ({ results, dispatch, isOpen, onClose }) => {
  const uids = getCheckedUids(results);
  const { folders, dashboards } = uids;
  const folderCount = folders.length;
  const dashCount = dashboards.length;
  let text = 'Do you want to delete the ';

  if (folderCount > 0 && dashCount > 0) {
    text += `selected folder${folderCount === 1 ? '' : 's'} and dashboard${dashCount === 1 ? '' : 's'}?`;
    text += `All dashboards of the selected folder${folderCount === 1 ? '' : 's'} will also be deleted`;
  } else if (folderCount > 0) {
    text += `selected folder${folderCount === 1 ? '' : 's'} and all its dashboards?`;
  } else {
    text += `selected dashboard${dashCount === 1 ? '' : 's'}?`;
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
      body={text}
      confirmText="Delete"
      onConfirm={deleteItems}
      onDismiss={onClose}
    />
  );
};
