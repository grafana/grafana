import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep as _cloneDeep } from 'lodash';

import { BMCUsersState, BMCUser } from 'app/types';

import { getUserFilters } from './selectors';

export const initialState: BMCUsersState = {
  users: [] as BMCUser[],
  totalCount: 0,
  selectedCount: undefined,
  page: 0,
  perPage: 30,
  isLoading: true,
  searchQuery: '',
  showSelected: false,
  usersAdded: [],
  usersRemoved: [],
};

export interface UsersFetchResult {
  users: BMCUser[];
  perPage: number;
  page: number;
  totalCount: number;
  selectedCount: number;
}

const usersSlice = createSlice({
  name: 'rbacUsers',
  initialState,
  reducers: {
    usersLoaded: (state, action: PayloadAction<{ users: UsersFetchResult; roleId: number }>): BMCUsersState => {
      const { perPage, page, users, totalCount, selectedCount } = action.payload.users;
      const usersClone = users?.length
        ? users.map((user) => {
            let isChecked: boolean;
            if (state.usersAdded.includes(user.id)) {
              isChecked = true;
            } else if (state.usersRemoved.includes(user.id)) {
              isChecked = false;
            } else {
              isChecked = user.bhdRoleIds.includes(action.payload.roleId);
            }
            return { ...user, isChecked };
          })
        : [];

      return {
        ...state,
        isLoading: false,
        users: usersClone,
        perPage,
        page,
        totalCount,
        selectedCount,
      };
    },
    searchQueryChanged: (state, action: PayloadAction<string>): BMCUsersState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, page: initialState.page };
    },
    userFilterChanged: (state, action: PayloadAction<string>): BMCUsersState => {
      // reset searchPage otherwise search results won't appear
      const showSelected = action.payload === getUserFilters().assigned.value;
      return { ...state, showSelected: showSelected, page: initialState.page };
    },
    usersFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    usersFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },

    CheckStatusChanged: (state, action: PayloadAction<{ checked: boolean; userId: number }>): BMCUsersState => {
      const { checked, userId } = action.payload;
      const usersClone = _cloneDeep(state.users);
      const added = new Set(state.usersAdded);
      const removed = new Set(state.usersRemoved);
      if (checked) {
        if (removed.has(userId)) {
          removed.delete(userId);
        } else {
          added.add(userId);
        }
        usersClone.find((user) => {
          if (user.id === userId) {
            user.isChecked = true;
          }
        });
      } else {
        if (added.has(userId)) {
          added.delete(userId);
        } else {
          removed.add(userId);
        }
        usersClone.find((user) => {
          if (user.id === userId) {
            user.isChecked = false;
          }
        });
      }

      return { ...state, users: usersClone, usersAdded: [...added], usersRemoved: [...removed] };
    },

    SelectAllStatusChanged: (state, action: PayloadAction<{ checked: boolean; roleId: number }>): BMCUsersState => {
      const { checked, roleId } = action.payload;
      const added = new Set(state.usersAdded);
      const removed = new Set(state.usersRemoved);
      const usersClone = _cloneDeep(state.users);

      usersClone.forEach((user) => {
        if (checked) {
          removed.delete(user.id);
          if (!user.bhdRoleIds.includes(roleId)) {
            added.add(user.id);
          }
        } else {
          added.delete(user.id);
          if (user.bhdRoleIds.includes(roleId)) {
            removed.add(user.id);
          }
        }
        user.isChecked = checked;
      });

      return { ...state, users: usersClone, usersAdded: [...added], usersRemoved: [...removed] };
    },

    ClearState: (state): BMCUsersState => {
      return { ...state, ...initialState };
    },
  },
});

export const {
  CheckStatusChanged,
  ClearState,
  searchQueryChanged,
  SelectAllStatusChanged,
  userFilterChanged,
  usersLoaded,
  usersFetchBegin,
  usersFetchEnd,
} = usersSlice.actions;

export const rbacUsersReducer = usersSlice.reducer;

export default {
  rbacUsers: rbacUsersReducer,
};
