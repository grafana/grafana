import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState, ApiKey } from 'app/types';
import { updateNavIndex, UpdateNavIndexAction } from 'app/core/actions';

export enum ActionTypes {
  LoadApiKeys = 'LOAD_API_KEYS',
}

export interface LoadApiKeysAction {
  type: ActionTypes.LoadApiKeys;
  payload: ApiKey[];
}

export type Action = LoadApiKeysAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action | UpdateNavIndexAction>;

const apiKeysLoaded = (apiKeys: ApiKey[]): LoadApiKeysAction => ({
  type: ActionTypes.LoadApiKeys,
  payload: apiKeys,
});

export function loadApiKeys(): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/auth/keys');
    dispatch(apiKeysLoaded(response));
  };
}

export function deleteApiKey(id: number): ThunkResult<void> {
  return async dispatch => {
    getBackendSrv()
      .delete('/api/auth/keys/' + id)
      .then(dispatch(loadApiKeys()));
  };
}
