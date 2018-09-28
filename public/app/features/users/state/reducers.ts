import { User, UsersState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: UsersState = { users: [] as User[], searchQuery: '' };

export const usersReducer = (state = initialState, action: Action): UsersState => {
  switch (action.type) {
    case ActionTypes.LoadUsers:
      return { ...state, users: action.payload };

    case ActionTypes.SetUsersSearchQuery:
      return { ...state, searchQuery: action.payload };
  }

  return state;
};

export default {
  users: usersReducer,
};
