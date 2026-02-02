import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BMCRole, BMCRolesState } from 'app/types';

export const initialRolesState: BMCRolesState = {
  roles: [],
  page: 1,
  searchRoleQuery: '',
  perPage: 30,
  totalCount: 0,
  hasFetched: false,
};

type RolesFetched = {
  roles: BMCRole[];
  page: number;
  perPage: number;
  totalCount: number;
};

const rolesSlice = createSlice({
  name: 'roles',
  initialState: initialRolesState,
  reducers: {
    rolesLoaded: (state, action: PayloadAction<RolesFetched>): BMCRolesState => {
      const { roles, page, perPage, totalCount } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);
      return { ...state, roles, page, perPage, totalCount: totalPages, hasFetched: true };
    },
    searchQueryChanged: (state, action: PayloadAction<string>): BMCRolesState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchRoleQuery: action.payload };
    },
    rolesFetchBegin: (state) => {
      return { ...state, hasFetched: false };
    },
    rolesFetchEnd: (state) => {
      return { ...state, hasFetched: true };
    },
    pageChanged: (state, action: PayloadAction<number>): BMCRolesState => {
      return { ...state, page: action.payload };
    },
  },
});

export const { rolesLoaded, searchQueryChanged, rolesFetchBegin, rolesFetchEnd, pageChanged } = rolesSlice.actions;

export const rolesReducer = rolesSlice.reducer;

export default {
  roles: rolesReducer,
};
