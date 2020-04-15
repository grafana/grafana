import { useMemo, useReducer } from 'react';
import { DashboardQuery, DashboardSection, OnDeleteItems, OnMoveItems, OnToggleChecked } from '../types';
import { DELETE_ITEMS, MOVE_ITEMS, TOGGLE_ALL_CHECKED, TOGGLE_CHECKED } from '../reducers/actionTypes';
import { manageDashboardsReducer, manageDashboardsState, ManageDashboardsState } from '../reducers/manageDashboards';
import { useSearch } from './useSearch';

export const useManageDashboards = (query: DashboardQuery, state: Partial<ManageDashboardsState> = {}) => {
  const reducer = useReducer(manageDashboardsReducer, {
    ...manageDashboardsState,
    ...state,
  });

  const {
    state: { results, loading, canSave, allChecked, hasEditPermissionInFolders },
    onToggleSection,
    dispatch,
  } = useSearch<ManageDashboardsState>(query, reducer);

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
