import React, { FC, useReducer, useState } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { useDebounce } from 'react-use';
import { Icon } from '@grafana/ui';
import { manageDashboardsState, reducer } from '../reducers/manageDashboards';
import { FETCH_RESULTS, TOGGLE_EDIT_PERMISSIONS, TOGGLE_FOLDER_CAN_SAVE } from '../reducers/actionTypes';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';
import { DashboardActions } from './DashboardActions';

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

  const onTagRemove = () => {};
  const onRemoveStarred = () => {};
  const onClearFilters = () => {};
  const moveTo = () => {};
  const onItemDelete = () => {};
  const onStarredFilterChange = () => {};
  const onTagFilterChange = () => {};
  const filterByTag = () => {};
  const onToggleSelection = () => {};
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
                <div className="gf-form-input gf-form-input--plaintext">
                  {query.tag.map(tag => {
                    return (
                      <a onClick={onTagRemove} tag-color-from-name="tagName" className="tag label label-tag">
                        <Icon name="times" />
                        &nbsp;{tag}
                      </a>
                    );
                  })}
                </div>
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
          onSelectAllChanged={onSelectAllChanged}
          allChecked={allChecked}
          canMove={canMove}
          canDelete={canDelete}
          moveTo={moveTo}
          deleteItem={onItemDelete}
          tagFilterOptions={[]}
          selectedStarredFilter={null}
          onStarredFilterChange={onStarredFilterChange}
          selectedTagFilter={''}
          onTagFilterChange={onTagFilterChange}
        />
        <div className="search-results-container">
          <SearchResults
            loading={loading}
            results={results}
            editable
            onTagSelected={filterByTag}
            onToggleSelection={onToggleSelection}
          />
        </div>
      </div>
    </div>
  );
};
