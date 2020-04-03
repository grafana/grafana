import React, { FC, useReducer, useState } from 'react';
import { useDebounce } from 'react-use';
import { parse, SearchParserResult } from 'search-query-parser';
import { Icon } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchQuery } from 'app/core/components/search/search';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchItemType, DashboardSection, SearchAction } from '../types';
import { findSelected, getFlattenedSections, getLookupField, hasId, markSelected } from '../utils';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';

const FETCH_RESULTS = 'FETCH_RESULTS';
const TOGGLE_SECTION = 'TOGGLE_SECTION';
const FETCH_ITEMS = 'FETCH_ITEMS';
const MOVE_SELECTION_UP = 'MOVE_SELECTION_UP';
const MOVE_SELECTION_DOWN = 'MOVE_SELECTION_DOWN';

const searchSrv = new SearchSrv();

const parseQuery = (query: string) => {
  const parsedQuery = parse(query, {
    keywords: ['folder'],
  });

  if (typeof parsedQuery === 'string') {
    return {
      text: parsedQuery,
    } as SearchParserResult;
  }

  return parsedQuery;
};

interface State {
  results: DashboardSection[];
  loading: boolean;
  selectedIndex: number;
}

const initialState: State = {
  results: [],
  loading: true,
  selectedIndex: 0,
};

const searchReducer = (state: any, action: SearchAction) => {
  switch (action.type) {
    case FETCH_RESULTS:
      // Highlight the first item ('Starred' folder)
      action.payload[0].selected = true;
      return { ...state, results: action.payload, loading: false };
    case TOGGLE_SECTION: {
      const section = action.payload;
      const lookupField = getLookupField(section.title);
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section[lookupField] === result[lookupField]) {
            result.expanded = !result.expanded;
          }
          return result;
        }),
      };
    }
    case FETCH_ITEMS: {
      const { section, items } = action.payload;
      return {
        ...state,
        results: state.results.map((result: DashboardSection) => {
          if (section.id === result.id) {
            result.items = items;
          }
          return result;
        }),
      };
    }
    case MOVE_SELECTION_DOWN: {
      const flatIds = getFlattenedSections(state.results);
      if (state.selectedIndex < flatIds.length - 1) {
        const newIndex = state.selectedIndex + 1;
        const selectedId = flatIds[newIndex];
        return {
          ...state,
          selectedIndex: newIndex,
          results: markSelected(state.results, selectedId),
        };
      }
      return state;
    }
    case MOVE_SELECTION_UP:
      if (state.selectedIndex > 0) {
        const flatIds = getFlattenedSections(state.results);
        const newIndex = state.selectedIndex - 1;
        const selectedId = flatIds[newIndex];
        return {
          ...state,
          selectedIndex: newIndex,
          results: markSelected(state.results, selectedId),
        };
      }
      return state;
    default:
      return state;
  }
};

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

  const onFilterBoxClick = () => {};

  return (
    <div className="search-container">
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
          <div className="search-filter-box" onClick={onFilterBoxClick}>
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
              {canEdit && (
                <a href="dashboard/import" className="search-filter-box-link">
                  <i className="gicon gicon-dashboard-import"></i> Import dashboard
                </a>
              )}
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
