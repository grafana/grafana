import React, { FC, useReducer, useState } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { searchReducer, initialState as searchState } from '../reducers/dashboardSearch';
import { useDebounce } from 'react-use';
import { FETCH_RESULTS } from '../reducers/actionTypes';
import { SearchSrv } from 'app/core/services/search_srv';
import { SearchAction } from '../types';
import { mergeReducers } from '../utils';

export interface InitialState {
  canMove: boolean;
  canDelete: boolean;
  canSave: boolean;
  allChecked: boolean;
  hasEditPermissionInFolders: boolean;
}

const initialState: InitialState = {
  canMove: false,
  canDelete: false,
  canSave: false,
  allChecked: false,
  hasEditPermissionInFolders: false,
};

export const TOGGLE_FOLDER_CAN_SAVE = 'TOGGLE_CAN_SAVE';
const manageDashboardsReducer = (state: InitialState = initialState, action: SearchAction) => {
  switch (action.type) {
    case TOGGLE_FOLDER_CAN_SAVE:
      return { ...state, canSave: action.payload };

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

  const [state, dispatch] = useReducer(reducer, {
    ...searchState,
    ...initialState,
    hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders,
  });

  const search = () => {
    searchSrv.search(query).then(results => {
      dispatch({ type: FETCH_RESULTS, payload: results });
      dispatch({ type: TOGGLE_FOLDER_CAN_SAVE, payload: true });
    });
  };

  useDebounce(search, 300, [query]);

  return <div />;
};
