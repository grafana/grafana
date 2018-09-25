import { Plugin, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { getBackendSrv } from '../../../core/services/backend_srv';

export enum ActionTypes {
  LoadPlugins = 'LOAD_PLUGINS',
}

export interface LoadPluginsAction {
  type: ActionTypes.LoadPlugins;
  payload: Plugin[];
}

export const pluginsLoaded = (plugins: Plugin[]): LoadPluginsAction => ({
  type: ActionTypes.LoadPlugins,
  payload: plugins,
});

export type Action = LoadPluginsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadPlugins(): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().get('api/plugins', { embedded: 0 });
    dispatch(pluginsLoaded(result));
  };
}
