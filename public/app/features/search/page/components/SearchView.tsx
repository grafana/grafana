import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Spinner, Button } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { FolderDTO } from 'app/types';

import { PreviewsSystemRequirements } from '../../components/PreviewsSystemRequirements';
import { getGrafanaSearcher } from '../../service';
import { getSearchStateManager } from '../../state/SearchStateManager';
import { SearchLayout } from '../../types';
import { newSearchSelection, updateSearchSelection } from '../selection';

import { ActionRow, getValidQueryLayout } from './ActionRow';
import { FolderSection } from './FolderSection';
import { FolderView } from './FolderView';
import { ManageActions } from './ManageActions';
import { SearchResultsCards } from './SearchResultsCards';
import { SearchResultsGrid } from './SearchResultsGrid';
import { SearchResultsTable, SearchResultsProps } from './SearchResultsTable';

export type SearchViewProps = {
  showManage: boolean;
  folderDTO?: FolderDTO;
  hidePseudoFolders?: boolean; // Recent + starred
  keyboardEvents: Observable<React.KeyboardEvent>;
};

export const SearchView = ({ showManage, folderDTO, hidePseudoFolders, keyboardEvents }: SearchViewProps) => {
  const styles = useStyles2(getStyles);
  const stateManager = getSearchStateManager(); // State is initialized from URL by parent component
  const state = stateManager.useState();

  const [searchSelection, setSearchSelection] = useState(newSearchSelection());
  const layout = getValidQueryLayout(state);
  const isFolders = layout === SearchLayout.Folders;

  const [listKey, setListKey] = useState(Date.now());

  // Search usage reporting
  useDebounce(stateManager.onReportSearchUsage, 1000, []);

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

  // function to update items when dashboards or folders are moved or deleted
  const onChangeItemsList = async () => {
    // clean up search selection
    clearSelection();
    setListKey(Date.now());
    // trigger again the search to the backend
    stateManager.onQueryChange(state.query);
  };

  const renderResults = () => {
    const value = state.result;

    if ((!value || !value.totalRows) && !isFolders) {
      if (state.loading && !value) {
        return <Spinner />;
      }

      return (
        <div className={styles.noResults}>
          <div>No results found for your query.</div>
          <br />
          <Button variant="secondary" onClick={stateManager.onClearSearchAndFilters}>
            Clear search and filters
          </Button>
        </div>
      );
    }

    const selection = showManage ? searchSelection.isSelected : undefined;
    if (layout === SearchLayout.Folders) {
      if (folderDTO) {
        return (
          <FolderSection
            section={{ uid: folderDTO.uid, kind: 'folder', title: folderDTO.title }}
            selection={selection}
            selectionToggle={toggleSelection}
            onTagSelected={stateManager.onAddTag}
            renderStandaloneBody={true}
            tags={state.tag}
            key={listKey}
            onClickItem={stateManager.onSearchItemClicked}
          />
        );
      }
      return (
        <FolderView
          key={listKey}
          selection={selection}
          selectionToggle={toggleSelection}
          tags={state.tag}
          onTagSelected={stateManager.onAddTag}
          hidePseudoFolders={hidePseudoFolders}
          onClickItem={stateManager.onSearchItemClicked}
        />
      );
    }

    return (
      <div style={{ height: '100%', width: '100%' }}>
        <AutoSizer>
          {({ width, height }) => {
            const props: SearchResultsProps = {
              response: value!,
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

            if (layout === SearchLayout.Grid) {
              return <SearchResultsGrid {...props} />;
            }

            if (width < 800) {
              return <SearchResultsCards {...props} />;
            }

            return <SearchResultsTable {...props} />;
          }}
        </AutoSizer>
      </div>
    );
  };

  if (folderDTO && !state.loading && !state.result?.totalRows && !stateManager.hasSearchFilters()) {
    return (
      <EmptyListCTA
        title="This folder doesn't have any dashboards yet"
        buttonIcon="plus"
        buttonTitle="Create Dashboard"
        buttonLink={`dashboard/new?folderUid=${folderDTO.uid}`}
        proTip="Add/move dashboards to your folder at ->"
        proTipLink="dashboards"
        proTipLinkTitle="Manage dashboards"
        proTipTarget=""
      />
    );
  }

  return (
    <>
      {Boolean(searchSelection.items.size > 0) ? (
        <ManageActions items={searchSelection.items} onChange={onChangeItemsList} clearSelection={clearSelection} />
      ) : (
        <ActionRow
          onLayoutChange={stateManager.onLayoutChange}
          showStarredFilter={hidePseudoFolders}
          onStarredFilterChange={!hidePseudoFolders ? undefined : stateManager.onStarredFilterChange}
          onSortChange={stateManager.onSortChange}
          onTagFilterChange={stateManager.onTagFilterChange}
          getTagOptions={stateManager.getTagOptions}
          getSortOptions={getGrafanaSearcher().getSortOptions}
          sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
          onDatasourceChange={stateManager.onDatasourceChange}
          onPanelTypeChange={stateManager.onPanelTypeChange}
          state={state}
          includePanels={state.includePanels!}
          onSetIncludePanels={stateManager.onSetIncludePanels}
        />
      )}

      {layout === SearchLayout.Grid && (
        <PreviewsSystemRequirements
          bottomSpacing={3}
          showPreviews={true}
          onRemove={() => stateManager.onLayoutChange(SearchLayout.List)}
        />
      )}
      {renderResults()}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  searchInput: css`
    margin-bottom: 6px;
    min-height: ${theme.spacing(4)};
  `,
  unsupported: css`
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 18px;
  `,
  noResults: css`
    padding: ${theme.v1.spacing.md};
    background: ${theme.v1.colors.bg2};
    font-style: italic;
    margin-top: ${theme.v1.spacing.md};
  `,
});
