import React, { Dispatch, FC } from 'react';
import { ConfirmModal } from '@grafana/ui';
import { DashboardSection, SearchAction } from '../types';
import { getCheckedUids } from '../utils';
import { DELETE_ITEM } from '../reducers/actionTypes';
import { backendSrv } from '../../../core/services/backend_srv';

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
  let text2;

  if (folderCount > 0 && dashCount > 0) {
    text += `selected folder${folderCount === 1 ? '' : 's'} and dashboard${dashCount === 1 ? '' : 's'}?`;
    text2 = `All dashboards of the selected folder${folderCount === 1 ? '' : 's'} will also be deleted`;
  } else if (folderCount > 0) {
    text += `selected folder${folderCount === 1 ? '' : 's'} and all its dashboards?`;
  } else {
    text += `selected dashboard${dashCount === 1 ? '' : 's'}?`;
  }

  const deleteItems = () => {
    backendSrv.deleteFoldersAndDashboards(folders, dashboards).then(() => {
      dispatch({ type: DELETE_ITEM, payload: uids });
    });
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Delete"
      body={text + text2}
      confirmText={'Confirm'}
      onConfirm={deleteItems}
      onDismiss={onClose}
    />
  );
};
