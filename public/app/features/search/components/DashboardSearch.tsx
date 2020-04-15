import React, { FC, useReducer } from 'react';
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
import { useSearchQuery } from '../hooks/useSearchQuery';

const searchSrv = new SearchSrv();

// TODO remove when search is refactored
const defaultQuery: SearchQuery = { query: '', parsedQuery: { text: '' }, tags: [], starred: false };
const { isEditor, hasEditPermissionInFolders } = contextSrv;
const canEdit = isEditor || hasEditPermissionInFolders;

export interface Props {
  onCloseSearch: () => void;
  payload?: OpenSearchParams;
}

export const DashboardSearch: FC<Props> = ({ onCloseSearch, payload = {} }) => {
  const { query, onQueryChange, onClearFilters, onTagFilterChange, onTagAdd } = useSearchQuery(payload);
  const [{ results, loading }, dispatch] = useReducer(searchReducer, dashboardsSearchState);
  const theme = useTheme();
  const styles = getStyles(theme);

  const search = () => {
    let folderIds: number[] = [];
    if (parseQuery(query.query).folder === 'current') {
      const { folderId } = getDashboardSrv().getCurrent().meta;
      if (folderId) {
        folderIds.push(folderId);
      }
    }
    searchSrv.search({ ...query, query: parseQuery(query.query).text, folderIds }).then(results => {
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

  return (
    <div tabIndex={0} className="search-container" onKeyDown={onClose}>
      <SearchField query={query} onChange={onQueryChange} onKeyDown={onKeyDown} autoFocus clearable />
      <div className="search-dropdown">
        <div className="search-dropdown__col_1">
          <CustomScrollbar>
            <div className="search-results-container">
              <SearchResults
                results={results}
                loading={loading}
                onTagSelected={onTagAdd}
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
              <Icon name="filter" className={styles.filter} size="sm" />
              Filter by:
              {query.tag.length > 0 && (
                <a className="pointer pull-right small" onClick={onClearFilters}>
                  <Icon name="times" size="sm" /> Clear
                </a>
              )}
            </div>

            <TagFilter tags={query.tag} tagOptions={searchSrv.getDashboardTags} onChange={onTagFilterChange} />
          </div>

          {canEdit && (
            <div className="search-filter-box" onClick={onCloseSearch}>
              <a href="dashboard/new" className="search-filter-box-link">
                <Icon name="apps" size="xl" className={styles.icon} /> New dashboard
              </a>
              {isEditor && (
                <a href="dashboards/folder/new" className="search-filter-box-link">
                  <Icon name="folder-plus" size="xl" className={styles.icon} /> New folder
                </a>
              )}
              <a href="dashboard/import" className="search-filter-box-link">
                <Icon name="import" size="xl" className={styles.icon} /> Import dashboard
              </a>
              <a
                className="search-filter-box-link"
                target="_blank"
                href="https://grafana.com/dashboards?utm_source=grafana_search"
              >
                <Icon name="search" size="xl" className={styles.icon} /> Find dashboards on Grafana.com
              </a>
            </div>
          )}
        </div>
        <div className={styles.closeBtn} onClick={onCloseSearch}>
          Close search <Icon name="times" className={styles.close} />
        </div>
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    closeBtn: css`
      top: 20px;
      right: 8px;
      position: absolute;
      font-size: ${theme.typography.size.xs};
      color: ${theme.colors.link};
      display: flex;
      align-items: center;
      cursor: pointer;
      &:hover {
        color: ${theme.colors.linkHover};
      }
    `,
    icon: css`
      margin-right: ${theme.spacing.sm};
      color: ${theme.palette.blue95};
    `,
    filter: css`
      margin-right: ${theme.spacing.xs};
    `,
    close: css`
      margin-left: ${theme.spacing.xs};
      margin-bottom: 1px;
    `,
  };
});
