import { Action, ActionTypes } from './actions';

export interface NavState {
  path: string;
  query: object;
}

const initialState: NavState = {
  path: '/test',
  query: {},
};

export const navReducer = (state: NavState = initialState, action: Action): NavState => {
  switch (action.type) {
    case ActionTypes.SET_NAV: {
      return { ...state, path: action.payload.path, query: action.payload.query };
    }

    case ActionTypes.SET_QUERY: {
      return {
        ...state,
        query: action.payload.query,
      };
    }

    default: {
      return state;
    }
  }
};
