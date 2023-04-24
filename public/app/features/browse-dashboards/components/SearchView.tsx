import React, { useCallback, useEffect } from 'react';

import { Spinner } from '@grafana/ui';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsProps, SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { getSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { DashboardViewItemKind } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types';

import { setItemSelectionState } from '../state';

interface SearchViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function SearchView({ folderUID, width, height }: SearchViewProps) {
  const dispatch = useDispatch();
  const selectedItems = useSelector((wholeState) => wholeState.browseDashboards.selectedItems);

  const { keyboardEvents } = useKeyNavigationListener();

  const stateManager = getSearchStateManager();
  useEffect(() => stateManager.initStateFromUrl(folderUID), [folderUID, stateManager]);

  const state = stateManager.useState();
  const value = state.result;

  const selectionChecker = useCallback(
    (kind: string | undefined, uid: string): boolean => {
      if (!kind || kind === '*') {
        return false;
      }

      return selectedItems[assertDashboardViewItemKind(kind)][uid] ?? false;
    },
    [selectedItems]
  );

  const clearSelection = useCallback(() => {
    console.log('TODO: clearSelection');
  }, []);

  const handleItemSelectionChange = useCallback(
    (kind: string, uid: string) => {
      const newIsSelected = !selectionChecker(kind, uid);

      dispatch(
        setItemSelectionState({ item: { kind: assertDashboardViewItemKind(kind), uid }, isSelected: newIsSelected })
      );
    },
    [selectionChecker, dispatch]
  );

  if (!value) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }

  const props: SearchResultsProps = {
    response: value,
    selection: selectionChecker,
    selectionToggle: handleItemSelectionChange,
    clearSelection,
    width: width,
    height: height,
    onTagSelected: stateManager.onAddTag,
    keyboardEvents,
    onDatasourceChange: state.datasource ? stateManager.onDatasourceChange : undefined,
    onClickItem: stateManager.onSearchItemClicked,
  };

  return <SearchResultsTable {...props} />;
}

function assertDashboardViewItemKind(kind: string): DashboardViewItemKind {
  switch (kind) {
    case 'folder':
      return 'folder';
    case 'dashboard':
      return 'dashboard';
    case 'panel':
      return 'panel';
  }

  throw new Error('Unsupported kind' + kind);
}
