import React, { FC, useReducer, useState } from 'react';
import { useDebounce } from 'react-use';
import { Icon } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchQuery } from 'app/core/components/search/search';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchItemType, DashboardSection } from '../types';
import { findSelected, hasId, parseQuery } from '../utils';
import { searchReducer, initialState } from '../reducers/dashboardSearch';
import {
  FETCH_ITEMS,
  FETCH_RESULTS,
  TOGGLE_SECTION,
  MOVE_SELECTION_DOWN,
  MOVE_SELECTION_UP,
} from '../reducers/actionTypes';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

const searchSrv = new SearchSrv();

const defaultQuery: SearchQuery = { query: '', parsedQuery: { text: '' }, tags: [], starred: false };
const { isEditor, hasEditPermissionInFolders } = contextSrv;
const canEdit = isEditor || hasEditPermissionInFolders;

export interface Props {
  closeSearch: () => void;
}

export const DashboardSearch: FC<Props> = ({ closeSearch }) => {
  const [query, setQuery] = useState(defaultQuery);
  const [{ results, loading }, dispatch] = useReducer(searchReducer, initialState);

  useDebounce(
    () => {
      search();
    },
    300,
    [query]
  );

  const search = () => {
    // TODO move query construction to search_srv
    searchSrv.search({ ...query, tag: query.tags, query: query.parsedQuery.text }).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  };

  const toggleSection = (section: DashboardSection) => {
    if (hasId(section.title) && !section.items.length) {
      backendSrv.search({ ...defaultQuery, folderIds: [section.id] }).then(items => {
        dispatch({ type: FETCH_ITEMS, payload: { section, items } });
        dispatch({ type: TOGGLE_SECTION, payload: section });
      });
    } else {
      dispatch({ type: TOGGLE_SECTION, payload: section });
    }
  };

  const onQueryChange = (searchQuery: string) => {
    setQuery(q => ({
      ...q,
      parsedQuery: parseQuery(searchQuery),
      query: searchQuery,
    }));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Escape':
        closeSearch();
        break;
      case 'ArrowUp':
        dispatch({ type: MOVE_SELECTION_UP });
        break;
      case 'ArrowDown':
        dispatch({ type: MOVE_SELECTION_DOWN });
        break;
      case 'Enter':
        const selectedItem = findSelected(results);
        if (selectedItem) {
          if (selectedItem.type === DashboardSearchItemType.DashFolder) {
            toggleSection(selectedItem as DashboardSection);
          } else {
            getLocationSrv().update({ path: selectedItem.url });
            // Delay closing to prevent current page flicker
            setTimeout(() => closeSearch(), 0);
          }
        }
    }
  };

  // The main search input has own keydown handler, also TagFilter uses input, so
  // clicking Esc when tagFilter is active shouldn't close the whole search overlay
  const handleClose = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if ((target.tagName as any) !== 'INPUT' && ['Escape', 'ArrowLeft'].includes(e.key)) {
      closeSearch();
    }
  };

  const onTagFiltersChanged = (tags: string[]) => {
    setQuery(q => ({ ...q, tags }));
  };

  const filterByTag = (tag: string) => {
    if (tag && !query.tags.includes(tag)) {
      setQuery(q => ({ ...q, tags: [...q.tags, tag] }));
    }
  };

  const clearSearchFilter = () => {
    setQuery(q => ({ ...q, tags: [], query: '' }));
  };

  return (
    <div tabIndex={0} className="search-container" onKeyDown={handleClose}>
      <SearchField query={query} onChange={onQueryChange} onKeyDown={onKeyDown} autoFocus={true} />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <div className="search-results-scroller">
            <div className="search-results-container">
              <SearchResults
                results={results}
                loading={loading}
                onTagSelected={filterByTag}
                dispatch={dispatch}
                editable={false}
                onToggleSection={toggleSection}
              />
            </div>
          </div>
        </div>
        <div className="search-dropdown__col_2">
          <div className="search-filter-box">
            <div className="search-filter-box__header">
              <Icon name="filter" />
              Filter by:
              {query.tags.length > 0 && (
                <a className="pointer pull-right small" onClick={clearSearchFilter}>
                  <Icon name="remove" /> Clear
                </a>
              )}
            </div>

            <TagFilter tags={query.tags} tagOptions={searchSrv.getDashboardTags} onChange={onTagFiltersChanged} />
          </div>

          {canEdit && (
            <div className="search-filter-box" onClick={() => closeSearch()}>
              <a href="dashboard/new" className="search-filter-box-link">
                <i className="gicon gicon-dashboard-new"></i> New dashboard
              </a>
              {isEditor && (
                <a href="dashboards/folder/new" className="search-filter-box-link">
                  <i className="gicon gicon-folder-new"></i> New folder
                </a>
              )}
              <a href="dashboard/import" className="search-filter-box-link">
                <i className="gicon gicon-dashboard-import"></i> Import dashboard
              </a>
              <a
                className="search-filter-box-link"
                target="_blank"
                href="https://grafana.com/dashboards?utm_source=grafana_search"
              >
                <img src="public/img/icn-dashboard-tiny.svg" width="20" /> Find dashboards on Grafana.com
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
