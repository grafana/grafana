import React, { FC, useReducer, useState } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { useDebounce } from 'react-use';
import { Icon, TagList } from '@grafana/ui';
import { manageDashboardsState, reducer } from '../reducers/manageDashboards';
import {
  FETCH_ITEMS,
  FETCH_RESULTS,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_FOLDER_CAN_SAVE,
  TOGGLE_SECTION,
} from '../reducers/actionTypes';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';
import { DashboardActions } from './DashboardActions';
import { DashboardSection } from '../types';
import { hasId } from '../utils';

export interface Props {
  folderId?: number;
  folderUid?: string;
}

class Query {
  query: string;
  mode: string;
  tag: any[];
  starred: boolean;
  skipRecent: boolean;
  skipStarred: boolean;
  folderIds: number[];
}

const searchSrv = new SearchSrv();

const defaultQuery: Query = {
  query: '',
  mode: 'tree',
  tag: [],
  starred: false,
  skipRecent: true,
  skipStarred: true,
  folderIds: [],
};

const initQuery = (folderId: number) => {
  if (folderId) {
    return { ...defaultQuery, folderIds: [folderId] };
  }
  return defaultQuery;
};

export const ManageDashboards: FC<Props> = ({ folderId, folderUid }) => {
  const [query, setQuery] = useState(() => initQuery(folderId));

  const [
    { canMove, canDelete, canSave, allChecked, isEditor, hasEditPermissionInFolders, results, loading },
    dispatch,
  ] = useReducer(reducer, {
    ...manageDashboardsState,
    hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders,
  });

  const search = () => {
    searchSrv
      .search(query)
      .then(results => {
        dispatch({ type: FETCH_RESULTS, payload: results });
      })
      .then(() => {
        if (!folderUid) {
          return undefined;
        }

        return backendSrv.getFolderByUid(folderUid).then(folder => {
          dispatch({ type: TOGGLE_FOLDER_CAN_SAVE, payload: folder.canSave });
          if (!folder.canSave) {
            dispatch({ type: TOGGLE_EDIT_PERMISSIONS, payload: false });
          }
        });
      });
  };

  useDebounce(search, 300, [query, folderUid]);

  const onQueryChange = (query: any) => {
    setQuery(query);
  };

  const onRemoveStarred = () => {};
  const onTagRemove = (tag: string) => {
    setQuery(q => ({ ...q, tag: q.tag.filter(t => tag !== t) }));
  };
  const onClearFilters = () => {
    setQuery(q => ({ ...q, tag: [] }));
  };
  const onTagFilterChange = (tags: string[]) => {
    setQuery(q => ({ ...q, tag: tags }));
  };
  const moveTo = () => {};
  const onItemDelete = () => {};
  const onStarredFilterChange = () => {};
  const filterByTag = () => {};

  // TODO move to reusable hook
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

  const onSelectAllChanged = () => {};
  const hasFilters = query.query.length > 0 || query.tag.length > 0 || query.starred;

  return (
    <div className="dashboard-list">
      <div className="page-action-bar page-action-bar--narrow">
        <label className="gf-form gf-form--grow gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input max-width-30"
            placeholder="Search dashboards by name"
            tabIndex={1}
            spellCheck={false}
            onChange={onQueryChange}
          />
          <Icon className="gf-form-input-icon" name="search" />
        </label>
        <DashboardActions isEditor={isEditor} canEdit={hasEditPermissionInFolders || canSave} folderId={folderId} />
      </div>

      {hasFilters && (
        <div className="page-action-bar page-action-bar--narrow">
          <div className="gf-form-inline">
            {query.tag.length > 0 && (
              <div className="gf-form">
                <label className="gf-form-label width-4">Tags</label>
                <TagList tags={query.tag} onClick={onTagRemove} />
              </div>
            )}
            {query.starred && (
              <div className="gf-form">
                <label className="gf-form-label">
                  <a className="pointer" onClick={onRemoveStarred}>
                    <Icon name="check" />
                    Starred
                  </a>
                </label>
              </div>
            )}
            <div className="gf-form">
              <label className="gf-form-label">
                <a className="pointer" onClick={onClearFilters}>
                  <Icon name="times" />
                  &nbsp;Clear
                </a>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="search-results">
        <SearchResultsFilter
          allChecked={allChecked}
          canDelete={canDelete}
          canMove={canMove}
          deleteItem={onItemDelete}
          moveTo={moveTo}
          onSelectAllChanged={onSelectAllChanged}
          onStarredFilterChange={onStarredFilterChange}
          onTagFilterChange={onTagFilterChange}
          selectedStarredFilter={null}
          selectedTagFilter={query.tag}
        />
        <div className="search-results-container">
          <SearchResults
            loading={loading}
            results={results}
            editable
            onTagSelected={filterByTag}
            onToggleSection={onToggleSection}
          />
        </div>
      </div>
    </div>
  );
};
