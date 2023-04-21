import React, { useCallback, useEffect, useState } from 'react';

import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsProps, SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { newSearchSelection, updateSearchSelection } from 'app/features/search/page/selection';
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
  const showManage = true; // TODO: bring this in from parent?

  const { keyboardEvents } = useKeyNavigationListener();

  const stateManager = getSearchStateManager();
  useEffect(() => stateManager.initStateFromUrl(folderUID), [folderUID, stateManager]);

  const state = stateManager.useState();

  const [searchSelection, setSearchSelection] = useState(() => newSearchSelection());

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
    searchSelection.items.clear();
    setSearchSelection({ ...searchSelection });
  }, [searchSelection]);

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
    return <div>loading?</div>;
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
