import React, { FC, useReducer, useState } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { searchReducer, State as DashboardSearchState, initialState as searchState } from '../reducers/dashboardSearch';
import { useDebounce } from 'react-use';
import { FETCH_RESULTS } from '../reducers/actionTypes';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchAction } from '../types';
import { mergeReducers } from '../utils';
import { Icon } from '@grafana/ui';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';

export interface State extends DashboardSearchState {
  canMove: boolean;
  canDelete: boolean;
  canSave: boolean;
  allChecked: boolean;
  hasEditPermissionInFolders: boolean;
}

const initialState: State = {
  ...searchState,
  canMove: false,
  canDelete: false,
  canSave: false,
  allChecked: false,
  hasEditPermissionInFolders: false,
};

export const TOGGLE_FOLDER_CAN_SAVE = 'TOGGLE_CAN_SAVE';
export const TOGGLE_EDIT_PERMISSIONS = 'TOGGLE_EDIT_PERMISSIONS';
const manageDashboardsReducer = (state: State, action: SearchAction) => {
  switch (action.type) {
    case TOGGLE_FOLDER_CAN_SAVE:
      return { ...state, canSave: action.payload };
    case TOGGLE_EDIT_PERMISSIONS:
      return { ...state, hasEditPermissionInFolders: action.payload };

    default:
      return state;
  }
};

const reducer = mergeReducers([searchReducer, manageDashboardsReducer]);

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
    ...initialState,
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
  const createDashboardUrl = () => '';
  const importDashboardUrl = () => '';
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
  const canEdit = hasEditPermissionInFolders || canSave;
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
        <div className="page-action-bar__spacer" />
        {canEdit && (
          <a className="btn btn-primary" href={createDashboardUrl()}>
            New Dashboard
          </a>
        )}
        {!folderId && isEditor && (
          <a className="btn btn-primary" href="dashboards/folder/new">
            New Folder
          </a>
        )}
        {canEdit && (
          <a className="btn btn-primary" href={importDashboardUrl()}>
            Import
          </a>
        )}
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
