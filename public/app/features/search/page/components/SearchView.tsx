import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { useCallback, useMemo, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Observable } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Spinner, Button } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { FolderDTO } from 'app/types';

import { PreviewsSystemRequirements } from '../../components/PreviewsSystemRequirements';
import { useSearchQuery } from '../../hooks/useSearchQuery';
import { getGrafanaSearcher, SearchQuery } from '../../service';
import { SearchLayout } from '../../types';
import {
  reportDashboardListViewed,
  reportSearchResultInteraction,
  reportSearchQueryInteraction,
  reportSearchFailedQueryInteraction,
} from '../reporting';
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
  includePanels: boolean;
  setIncludePanels: (v: boolean) => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
};

export const SearchView = ({
  showManage,
  folderDTO,
  hidePseudoFolders,
  includePanels,
  setIncludePanels,
  keyboardEvents,
}: SearchViewProps) => {
  const styles = useStyles2(getStyles);

  const {
    query,
    onQueryChange,
    onTagFilterChange,
    onStarredFilterChange,
    onTagAdd,
    onDatasourceChange,
    onSortChange,
    onLayoutChange,
    onClearStarred,
    onSelectSearchItem,
  } = useSearchQuery({});

  const [searchSelection, setSearchSelection] = useState(newSearchSelection());
  const layout = getValidQueryLayout(query);
  const isFolders = layout === SearchLayout.Folders;

  const [listKey, setListKey] = useState(Date.now());
  const eventTrackingNamespace = folderDTO ? 'manage_dashboards' : 'dashboard_search';

  const searchQuery = useMemo(() => {
    const q: SearchQuery = {
      query: query.query,
      tags: query.tag as string[],
      ds_uid: query.datasource as string,
      location: folderDTO?.uid, // This will scope all results to the prefix
      sort: query.sort?.value,
      explain: query.explain,
      withAllowedActions: query.explain, // allowedActions are currently not used for anything on the UI and added only in `explain` mode
      starred: query.starred,
    };

    // Only dashboards have additional properties
    if (q.sort?.length && !q.sort.includes('name')) {
      q.kind = ['dashboard', 'folder']; // skip panels
    }

    if (!q.query?.length) {
      q.query = '*';
      if (!q.location) {
        q.kind = ['dashboard', 'folder']; // skip panels
      }
    }

    if (!includePanels && !q.kind) {
      q.kind = ['dashboard', 'folder']; // skip panels
    }

    if (q.query === '*' && !q.sort?.length) {
      q.sort = 'name_sort';
    }
    return q;
  }, [query, folderDTO, includePanels]);

  // Search usage reporting
  useDebounce(
    () => {
      reportDashboardListViewed(eventTrackingNamespace, {
        layout: query.layout,
        starred: query.starred,
        sortValue: query.sort?.value,
        query: query.query,
        tagCount: query.tag?.length,
        includePanels,
      });
    },
    1000,
    []
  );

  const onClickItem = () => {
    reportSearchResultInteraction(eventTrackingNamespace, {
      layout: query.layout,
      starred: query.starred,
      sortValue: query.sort?.value,
      query: query.query,
      tagCount: query.tag?.length,
      includePanels,
    });
    onSelectSearchItem();
  };

  const doSearch = useMemo(
    () =>
      debounce((query, searchQuery, includePanels, eventTrackingNamespace) => {
        const trackingInfo = {
          layout: query.layout,
          starred: query.starred,
          sortValue: query.sort?.value,
          query: query.query,
          tagCount: query.tag?.length,
          includePanels,
        };

        reportSearchQueryInteraction(eventTrackingNamespace, trackingInfo);

        if (searchQuery.starred) {
          return getGrafanaSearcher()
            .starred(searchQuery)
            .catch((error) =>
              reportSearchFailedQueryInteraction(eventTrackingNamespace, { ...trackingInfo, error: error?.message })
            );
        }

        return getGrafanaSearcher()
          .search(searchQuery)
          .catch((error) =>
            reportSearchFailedQueryInteraction(eventTrackingNamespace, { ...trackingInfo, error: error?.message })
          );
      }, 300),
    []
  );

  const results = useAsync(() => doSearch(query, searchQuery, includePanels, eventTrackingNamespace), [searchQuery]);

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

  // This gets the possible tags from within the query results
  const getTagOptions = (): Promise<TermCount[]> => {
    return getGrafanaSearcher().tags(searchQuery);
  };

  // function to update items when dashboards or folders are moved or deleted
  const onChangeItemsList = async () => {
    // clean up search selection
    clearSelection();
    setListKey(Date.now());
    // trigger again the search to the backend
    onQueryChange(query.query);
  };

  const getStarredItems = useCallback(
    (e) => {
      onStarredFilterChange(e);
    },
    [onStarredFilterChange]
  );

  const renderResults = () => {
    const value = results.value;

    if ((!value || !value.totalRows) && !isFolders) {
      if (results.loading && !value) {
        return <Spinner />;
      }

      return (
        <div className={styles.noResults}>
          <div>No results found for your query.</div>
          <br />
          <Button
            variant="secondary"
            onClick={() => {
              if (query.query) {
                onQueryChange('');
              }
              if (query.tag?.length) {
                onTagFilterChange([]);
              }
              if (query.datasource) {
                onDatasourceChange(undefined);
              }
            }}
          >
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
            onTagSelected={onTagAdd}
            renderStandaloneBody={true}
            tags={query.tag}
            key={listKey}
            onClickItem={onClickItem}
          />
        );
      }
      return (
        <FolderView
          key={listKey}
          selection={selection}
          selectionToggle={toggleSelection}
          tags={query.tag}
          onTagSelected={onTagAdd}
          hidePseudoFolders={hidePseudoFolders}
          onClickItem={onClickItem}
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
              onTagSelected: onTagAdd,
              keyboardEvents,
              onDatasourceChange: query.datasource ? onDatasourceChange : undefined,
              onClickItem: onClickItem,
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

  if (folderDTO && !results.loading && !results.value?.totalRows && !query.query.length) {
    return (
      <EmptyListCTA
        title="This folder doesn't have any dashboards yet"
        buttonIcon="plus"
        buttonTitle="Create Dashboard"
        buttonLink={`dashboard/new?folderId=${folderDTO.id}`}
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
          onLayoutChange={(v) => {
            if (v === SearchLayout.Folders) {
              if (query.query) {
                onQueryChange(''); // parent will clear the sort
              }
              if (query.starred) {
                onClearStarred();
              }
            }
            onLayoutChange(v);
          }}
          showStarredFilter={hidePseudoFolders}
          onStarredFilterChange={!hidePseudoFolders ? undefined : getStarredItems}
          onSortChange={onSortChange}
          onTagFilterChange={onTagFilterChange}
          getTagOptions={getTagOptions}
          getSortOptions={getGrafanaSearcher().getSortOptions}
          onDatasourceChange={onDatasourceChange}
          query={query}
          includePanels={includePanels!}
          setIncludePanels={setIncludePanels}
        />
      )}

      {layout === SearchLayout.Grid && (
        <PreviewsSystemRequirements
          bottomSpacing={3}
          showPreviews={true}
          onRemove={() => onLayoutChange(SearchLayout.List)}
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
