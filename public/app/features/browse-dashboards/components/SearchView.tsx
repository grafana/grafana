import { ReactNode, useCallback } from 'react';

import { DataFrameView, toDataFrame } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, EmptyState } from '@grafana/ui';
import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsProps, SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { SearchStateManager } from 'app/features/search/state/SearchStateManager';
import { DashboardViewItemKind, SearchState } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types/store';

import { useHasSelection } from '../state/hooks';
import { setAllSelection, setItemSelectionState } from '../state/slice';
import { BrowseDashboardsPermissions } from '../types';

import { canEditItemType, canSelectItems } from './utils';

interface SearchViewProps {
  height: number;
  width: number;
  permissions: BrowseDashboardsPermissions;
  searchState: SearchState;
  searchStateManager: SearchStateManager;
  emptyState?: ReactNode;
}

const NUM_PLACEHOLDER_ROWS = 25;
const initialLoadingView = {
  view: new DataFrameView(
    toDataFrame({
      fields: [
        { name: 'uid', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill(null) },
        { name: 'kind', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('dashboard') },
        { name: 'name', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('') },
        { name: 'location', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill('') },
        { name: 'tags', display: true, values: Array(NUM_PLACEHOLDER_ROWS).fill([]) },
      ],
      meta: {
        custom: {
          locationInfo: [],
        },
      },
    })
  ),
  loadMoreItems: () => Promise.resolve(),
  // this is key and controls whether to show the skeleton in generateColumns
  isItemLoaded: () => false,
  totalRows: NUM_PLACEHOLDER_ROWS,
};

export function SearchView({
  width,
  height,
  permissions,
  searchState,
  searchStateManager: stateManager,
  emptyState: emptyStateProp,
}: SearchViewProps) {
  const dispatch = useDispatch();
  const selectedItems = useSelector((wholeState) => wholeState.browseDashboards.selectedItems);
  const hasSelection = useHasSelection();

  const { keyboardEvents } = useKeyNavigationListener();

  const value = searchState.result ?? initialLoadingView;

  const selectionChecker = useCallback(
    (kind: string | undefined, uid: string): boolean => {
      if (!kind) {
        return false;
      }

      // Check if user has permission to select this item type
      if (!canEditItemType(kind, permissions)) {
        return false;
      }

      // Currently, this indicates _some_ items are selected, not necessarily all are
      // selected.
      if (kind === '*' && uid === '*') {
        return hasSelection;
      } else if (kind === '*') {
        // Unsure how this case can happen
        return false;
      }

      return selectedItems[assertDashboardViewItemKind(kind)][uid] ?? false;
    },
    [selectedItems, hasSelection, permissions]
  );

  const clearSelection = useCallback(() => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
  }, [dispatch]);

  const handleItemSelectionChange = useCallback(
    (kind: string, uid: string) => {
      if (!canEditItemType(kind, permissions)) {
        return; // Cannot select this item
      }

      const newIsSelected = !selectionChecker(kind, uid);

      dispatch(
        setItemSelectionState({ item: { kind: assertDashboardViewItemKind(kind), uid }, isSelected: newIsSelected })
      );
    },
    [selectionChecker, dispatch, permissions]
  );

  if (value.totalRows === 0) {
    const emptyState = emptyStateProp ?? (
      <EmptyState
        button={
          <Button variant="secondary" onClick={stateManager.onClearSearchAndFilters}>
            <Trans i18nKey="browse-dashboards.no-results.clear">Clear search and filters</Trans>
          </Button>
        }
        message={t('browse-dashboards.no-results.text', 'No results found for your query')}
        variant="not-found"
        role="alert"
      />
    );

    return <div style={{ width }}>{emptyState}</div>;
  }

  const canSelect = canSelectItems(permissions);
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
    onClickItem: searchState.deleted ? undefined : stateManager.onSearchItemClicked,
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
