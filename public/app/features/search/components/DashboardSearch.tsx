import React, { FC, useReducer, useState } from 'react';
import { useDebounce } from 'react-use';
import { css } from 'emotion';
import { Icon, useTheme, CustomScrollbar, stylesFactory } from '@grafana/ui';
import { getLocationSrv } from '@grafana/runtime';
import { GrafanaTheme } from '@grafana/data';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchQuery } from 'app/core/components/search/search';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchItemType, DashboardSection, OpenSearchParams } from '../types';
import { findSelected, hasId, parseQuery } from '../utils';
import { searchReducer, dashboardsSearchState } from '../reducers/dashboardSearch';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
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
  onCloseSearch: () => void;
  payload?: OpenSearchParams;
}

export const DashboardSearch: FC<Props> = ({ onCloseSearch, payload = {} }) => {
  const [query, setQuery] = useState({ ...defaultQuery, ...payload, parsedQuery: parseQuery(payload.query) });
  const [{ results, loading }, dispatch] = useReducer(searchReducer, dashboardsSearchState);
  const theme = useTheme();
  const styles = getStyles(theme);

  const search = () => {
    let folderIds: number[] = [];
    if (query.parsedQuery.folder === 'current') {
      const { folderId } = getDashboardSrv().getCurrent().meta;
      if (folderId) {
        folderIds.push(folderId);
      }
    }
    searchSrv.search({ ...query, tag: query.tags, query: query.parsedQuery.text, folderIds }).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
    });
  };

  useDebounce(search, 300, [query]);

  const onToggleSection = (section: DashboardSection) => {
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
        onCloseSearch();
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
            onToggleSection(selectedItem as DashboardSection);
          } else {
            getLocationSrv().update({ path: selectedItem.url });
            // Delay closing to prevent current page flicker
            setTimeout(onCloseSearch, 0);
          }
        }
    }
  };

  // The main search input has own keydown handler, also TagFilter uses input, so
  // clicking Esc when tagFilter is active shouldn't close the whole search overlay
  const onClose = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if ((target.tagName as any) !== 'INPUT' && ['Escape', 'ArrowLeft'].includes(e.key)) {
      onCloseSearch();
    }
  };

  const onTagFiltersChanged = (tags: string[]) => {
    setQuery(q => ({ ...q, tags }));
  };

  const onTagSelected = (tag: string) => {
    if (tag && !query.tags.includes(tag)) {
      setQuery(q => ({ ...q, tags: [...q.tags, tag] }));
    }
  };

  const onClearSearchFilters = () => {
    setQuery(q => ({ ...q, tags: [] }));
  };

  return (
    <div tabIndex={0} className="search-container" onKeyDown={onClose}>
      <SearchField query={query} onChange={onQueryChange} onKeyDown={onKeyDown} autoFocus={true} />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <CustomScrollbar>
            <div className="search-results-container">
              <SearchResults
                results={results}
                loading={loading}
                onTagSelected={onTagSelected}
                dispatch={dispatch}
                editable={false}
                onToggleSection={onToggleSection}
              />
            </div>
          </CustomScrollbar>
        </div>
        <div className="search-dropdown__col_2">
          <div className="search-filter-box">
            <div className="search-filter-box__header">
              <Icon name="filter" />
              Filter by:
              {query.tags.length > 0 && (
                <a className="pointer pull-right small" onClick={onClearSearchFilters}>
                  <Icon name="times" /> Clear
                </a>
              )}
            </div>

            <TagFilter tags={query.tags} tagOptions={searchSrv.getDashboardTags} onChange={onTagFiltersChanged} />
          </div>

          {canEdit && (
            <div className="search-filter-box" onClick={onCloseSearch}>
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
        <Icon onClick={onCloseSearch} className={styles.closeBtn} name="times" />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    closeBtn: css`
      font-size: 22px;
      margin-top: 14px;
      margin-right: 6px;

      &:hover {
        cursor: pointer;
        color: ${theme.colors.white};
      }

      @media only screen and (max-width: ${theme.breakpoints.md}) {
        position: absolute;
        right: 15px;
        top: 60px;
      }
    `,
  };
});
