import { useCallback, useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';

import { reportInteraction } from '@grafana/runtime/src';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO } from 'app/types';

import { GENERAL_FOLDER_ID } from '../constants';
import { DELETE_ITEMS, MOVE_ITEMS, TOGGLE_ALL_CHECKED, TOGGLE_CHECKED } from '../reducers/actionTypes';
import { manageDashboardsReducer, manageDashboardsState, ManageDashboardsState } from '../reducers/manageDashboards';
import { DashboardQuery, DashboardSection, OnDeleteItems, OnMoveItems, OnToggleChecked, SearchLayout } from '../types';

import { useSearch } from './useSearch';
import { useShowDashboardPreviews } from './useShowDashboardPreviews';

const hasChecked = (section: DashboardSection) => {
  return section.checked || section.items.some((item) => item.checked);
};

export const reportDashboardListViewed = (
  dashboardListType: 'manage_dashboards' | 'dashboard_search',
  showPreviews: boolean,
  previewsEnabled: boolean,
  query: {
    layout?: SearchLayout;
    starred?: boolean;
    sortValue?: string;
    query?: string;
    tagCount?: number;
  }
) => {
  const previews = previewsEnabled ? (showPreviews ? 'on' : 'off') : 'feature_disabled';
  reportInteraction(`${dashboardListType}_viewed`, {
    previews,
    layout: query.layout,
    starredFilter: query.starred ?? false,
    sort: query.sortValue ?? '',
    tagCount: query.tagCount ?? 0,
    queryLength: query.query?.length ?? 0,
  });
};

export const useManageDashboards = (
  query: DashboardQuery,
  state: Partial<ManageDashboardsState> = {},
  folder?: FolderDTO
) => {
  const reducer = useReducer(manageDashboardsReducer, {
    ...manageDashboardsState,
    ...state,
  });

  const { showPreviews, setShowPreviews, previewFeatureEnabled } = useShowDashboardPreviews();
  useDebounce(
    () => {
      reportDashboardListViewed('manage_dashboards', showPreviews, previewFeatureEnabled, {
        layout: query.layout,
        starred: query.starred,
        sortValue: query.sort?.value,
        query: query.query,
        tagCount: query.tag?.length,
      });
    },
    1000,
    [
      showPreviews,
      previewFeatureEnabled,
      query.layout,
      query.starred,
      query.sort?.value,
      query.query?.length,
      query.tag?.length,
    ]
  );

  const {
    state: { results, loading, initialLoading, allChecked },
    onToggleSection,
    dispatch,
  } = useSearch<ManageDashboardsState>(query, reducer, {});

  const onToggleChecked: OnToggleChecked = useCallback(
    (item) => {
      dispatch({ type: TOGGLE_CHECKED, payload: item });
    },
    [dispatch]
  );

  const onToggleAllChecked = () => {
    dispatch({ type: TOGGLE_ALL_CHECKED });
  };

  const onDeleteItems: OnDeleteItems = (folders, dashboards) => {
    dispatch({ type: DELETE_ITEMS, payload: { folders, dashboards } });
  };

  const onMoveItems: OnMoveItems = (selectedDashboards, folder) => {
    dispatch({ type: MOVE_ITEMS, payload: { dashboards: selectedDashboards, folder } });
  };

  const canMove = useMemo(() => results.some((result) => result.items.some((item) => item.checked)), [results]);

  const canDelete = useMemo(() => {
    const somethingChecked = results.some(hasChecked);
    const includesGeneralFolder = results.find((result) => result.checked && result.id === GENERAL_FOLDER_ID);
    return somethingChecked && !includesGeneralFolder;
  }, [results]);

  const canSave = folder?.canSave;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;
  const noFolders = canSave && folder?.id && results.length === 0 && !loading && !initialLoading;

  return {
    results,
    loading,
    initialLoading,
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
    noFolders,
    showPreviews,
    setShowPreviews,
  };
};
