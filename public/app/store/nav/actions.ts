//
// Only test actions to test redux & typescript
//

export enum ActionTypes {
  SET_NAV = 'SET_NAV',
  SET_QUERY = 'SET_QUERY',
}

export interface SetNavAction {
  type: ActionTypes.SET_NAV;
  payload: {
    path: string;
    query: object;
  };
}

export interface SetQueryAction {
  type: ActionTypes.SET_QUERY;
  payload: {
    query: object;
  };
}

export type Action = SetNavAction | SetQueryAction;

export const setNav = (path: string, query: object): SetNavAction => ({
  type: ActionTypes.SET_NAV,
  payload: { path: path, query: query },
});
