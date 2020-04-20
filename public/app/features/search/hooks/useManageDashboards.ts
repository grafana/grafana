import { useMemo, useReducer } from 'react';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardQuery, DashboardSection, OnDeleteItems, OnMoveItems, OnToggleChecked } from '../types';
import {
  DELETE_ITEMS,
  MOVE_ITEMS,
  TOGGLE_ALL_CHECKED,
  TOGGLE_CHECKED,
  TOGGLE_CAN_SAVE,
  TOGGLE_EDIT_PERMISSIONS,
} from '../reducers/actionTypes';
import { manageDashboardsReducer, manageDashboardsState, ManageDashboardsState } from '../reducers/manageDashboards';
import { useSearch } from './useSearch';

export const useManageDashboards = (
  query: DashboardQuery,
  state: Partial<ManageDashboardsState> = {},
  folderUid?: string
) => {
  const reducer = useReducer(manageDashboardsReducer, {
    ...manageDashboardsState,
    ...state,
  });

  const searchCallback = (folderUid: string | undefined) => {
    if (folderUid) {
      backendSrv.getFolderByUid(folderUid).then(folder => {
        dispatch({ type: TOGGLE_CAN_SAVE, payload: folder.canSave });
        if (!folder.canSave) {
          dispatch({ type: TOGGLE_EDIT_PERMISSIONS, payload: false });
        }
      });
    }
  };

  const {
    state: { results, loading, canSave, allChecked, hasEditPermissionInFolders },
    onToggleSection,
    dispatch,
  } = useSearch<ManageDashboardsState>(query, reducer, { folderUid, searchCallback });

  const onToggleChecked: OnToggleChecked = item => {
    dispatch({ type: TOGGLE_CHECKED, payload: item });
  };

  const onToggleAllChecked = () => {
    dispatch({ type: TOGGLE_ALL_CHECKED });
  };

  const onDeleteItems: OnDeleteItems = (folders, dashboards) => {
    dispatch({ type: DELETE_ITEMS, payload: { folders, dashboards } });
  };

  const onMoveItems: OnMoveItems = (selectedDashboards, folder) => {
    dispatch({ type: MOVE_ITEMS, payload: { dashboards: selectedDashboards, folder } });
  };

  const canMove = useMemo(() => results.some((result: DashboardSection) => result.items.some(item => item.checked)), [
    results,
  ]);
  const canDelete = useMemo(() => canMove || results.some((result: DashboardSection) => result.checked), [
    canMove,
    results,
  ]);

  return {
    results,
    loading,
    canSave,
    allChecked,
    hasEditPermissionInFolders,
    canMove,
    canDelete,
    onToggleSection,
    onToggleChecked,
    onToggleAllChecked,
    onDeleteItems,
    onMoveItems,
  };
};
