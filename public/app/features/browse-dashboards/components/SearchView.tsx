import React, { useCallback, useEffect, useState } from 'react';

import { useKeyNavigationListener } from 'app/features/search/hooks/useSearchKeyboardSelection';
import { SearchResultsProps, SearchResultsTable } from 'app/features/search/page/components/SearchResultsTable';
import { newSearchSelection, updateSearchSelection } from 'app/features/search/page/selection';
import { getSearchStateManager } from 'app/features/search/state/SearchStateManager';

interface SearchViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function SearchView({ folderUID, width, height }: SearchViewProps) {
  const showManage = true; // TODO: bring this in from parent?

  const { keyboardEvents } = useKeyNavigationListener();

  const stateManager = getSearchStateManager();
  useEffect(() => stateManager.initStateFromUrl(folderUID), [folderUID, stateManager]);

  const state = stateManager.useState();

  const [searchSelection, setSearchSelection] = useState(() => newSearchSelection());

  const value = state.result;

  const selection = showManage ? searchSelection.isSelected : undefined;

  const clearSelection = useCallback(() => {
    searchSelection.items.clear();
    setSearchSelection({ ...searchSelection });
  }, [searchSelection]);

  const toggleSelection = useCallback(
    (kind: string, uid: string) => {
      const current = searchSelection.isSelected(kind, uid);
      setSearchSelection(updateSearchSelection(searchSelection, !current, kind, [uid]));
    },
    [searchSelection]
  );

  if (!value) {
    return <div>loading?</div>;
  }

  const props: SearchResultsProps = {
    response: value,
    selection,
    selectionToggle: toggleSelection,
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
