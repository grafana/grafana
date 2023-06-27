import React, { useCallback } from 'react';

import { DataFrameView, toDataFrame } from '@grafana/data';
import { Button, Card } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsProps, SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { LOADING_ID } from 'app/features/search/page/components/columns';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { DashboardViewItemKind } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types';

import { setAllSelection, setItemSelectionState, useHasSelection } from '../state';

interface SearchViewProps {
  height: number;
  width: number;
  canSelect: boolean;
}

const loadingView = {
  view: new DataFrameView(
    toDataFrame({
      fields: [
        { name: 'uid', display: true, values: Array(50).fill(null) },
        { name: 'name', display: true, values: Array(50).fill(LOADING_ID) },
        { name: 'tags', display: false, values: Array(50).fill(null) },
      ],
    })
  ),
  loadMoreItems: () => Promise.resolve(),
  isItemLoaded: () => true,
  totalRows: 50,
};

export function SearchView({ width, height, canSelect }: SearchViewProps) {
  const dispatch = useDispatch();
  const selectedItems = useSelector((wholeState) => wholeState.browseDashboards.selectedItems);
  const hasSelection = useHasSelection();

  const { keyboardEvents } = useKeyNavigationListener();
  const [searchState, stateManager] = useSearchStateManager();

  const value = searchState.result ?? loadingView;

  const selectionChecker = useCallback(
    (kind: string | undefined, uid: string): boolean => {
      if (!kind) {
        return false;
      }

      // Currently, this indicates _some_ items are selected, not nessicarily all are
      // selected.
      if (kind === '*' && uid === '*') {
        return hasSelection;
      } else if (kind === '*') {
        // Unsure how this case can happen
        return false;
      }

      return selectedItems[assertDashboardViewItemKind(kind)][uid] ?? false;
    },
    [selectedItems, hasSelection]
  );

  const clearSelection = useCallback(() => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
  }, [dispatch]);

  const handleItemSelectionChange = useCallback(
    (kind: string, uid: string) => {
      const newIsSelected = !selectionChecker(kind, uid);

      dispatch(
        setItemSelectionState({ item: { kind: assertDashboardViewItemKind(kind), uid }, isSelected: newIsSelected })
      );
    },
    [selectionChecker, dispatch]
  );

  if (value.totalRows === 0) {
    return (
      <div style={{ width }}>
        <Card>
          <Card.Heading>
            <Trans i18nKey="browse-dashboards.no-results.text">No results found for your query.</Trans>
          </Card.Heading>
          <Card.Actions>
            <Button variant="secondary" onClick={stateManager.onClearSearchAndFilters}>
              <Trans i18nKey="browse-dashboards.no-results.clear">Clear search and filters</Trans>
            </Button>
          </Card.Actions>
        </Card>
      </div>
    );
  }

  const props: SearchResultsProps = {
    response: value,
    selection: canSelect ? selectionChecker : undefined,
    selectionToggle: canSelect ? handleItemSelectionChange : undefined,
    clearSelection,
    width: width,
    height: height,
    onTagSelected: stateManager.onAddTag,
    keyboardEvents,
    onDatasourceChange: searchState.datasource ? stateManager.onDatasourceChange : undefined,
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
