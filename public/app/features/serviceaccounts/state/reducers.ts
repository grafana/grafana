import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Role } from 'app/types/accessControl';
import { ApiKey } from 'app/types/apiKeys';
import {
  ServiceAccountProfileState,
  ServiceAccountDTO,
  ServiceAccountsState,
  ServiceAccountStateFilter,
} from 'app/types/serviceaccount';

// serviceAccountsProfilePage
export const initialStateProfile: ServiceAccountProfileState = {
  serviceAccount: {} as ServiceAccountDTO,
  isLoading: true,
  tokens: [],
};

export const serviceAccountProfileSlice = createSlice({
  name: 'serviceaccount',
  initialState: initialStateProfile,
  reducers: {
    serviceAccountFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    serviceAccountFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },
    serviceAccountLoaded: (state, action: PayloadAction<ServiceAccountDTO>): ServiceAccountProfileState => {
      return { ...state, serviceAccount: action.payload, isLoading: false };
    },
    serviceAccountTokensLoaded: (state, action: PayloadAction<ApiKey[]>): ServiceAccountProfileState => {
      return { ...state, tokens: action.payload, isLoading: false };
    },
    rolesFetchBegin: (state) => {
      return { ...state, rolesLoading: true };
    },
    rolesFetchEnd: (state) => {
      return { ...state, rolesLoading: false };
    },
  },
});

export const serviceAccountProfileReducer = serviceAccountProfileSlice.reducer;
export const {
  serviceAccountLoaded,
  serviceAccountTokensLoaded,
  serviceAccountFetchBegin,
  serviceAccountFetchEnd,
  rolesFetchBegin,
  rolesFetchEnd,
} = serviceAccountProfileSlice.actions;

// serviceAccountsListPage
export const initialStateList: ServiceAccountsState = {
  serviceAccounts: [],
  isLoading: true,
  roleOptions: [],
  query: '',
  page: 0,
  perPage: 50,
  totalPages: 1,
  showPaging: false,
  serviceAccountStateFilter: ServiceAccountStateFilter.All,
};

interface ServiceAccountsFetched {
  serviceAccounts: ServiceAccountDTO[];
  perPage: number;
  page: number;
  totalCount: number;
}

const serviceAccountsSlice = createSlice({
  name: 'serviceaccounts',
  initialState: initialStateList,
  reducers: {
    serviceAccountsFetched: (state, action: PayloadAction<ServiceAccountsFetched>): ServiceAccountsState => {
      const { totalCount, perPage, ...rest } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      return {
        ...state,
        ...rest,
        totalPages,
        perPage,
        showPaging: totalPages > 1,
        isLoading: false,
      };
    },
    serviceAccountsFetchBegin: (state) => {
      return { ...state, isLoading: true };
    },
    serviceAccountsFetchEnd: (state) => {
      return { ...state, isLoading: false };
    },
    acOptionsLoaded: (state, action: PayloadAction<Role[]>): ServiceAccountsState => {
      return { ...state, roleOptions: action.payload };
    },
    queryChanged: (state, action: PayloadAction<string>) => {
      return {
        ...state,
        query: action.payload,
        page: 0,
      };
    },
    pageChanged: (state, action: PayloadAction<number>) => ({
      ...state,
      page: action.payload,
    }),
    stateFilterChanged: (state, action: PayloadAction<ServiceAccountStateFilter>) => ({
      ...state,
      serviceAccountStateFilter: action.payload,
    }),
  },
});
export const serviceAccountsReducer = serviceAccountsSlice.reducer;

export const {
  serviceAccountsFetchBegin,
  serviceAccountsFetchEnd,
  serviceAccountsFetched,
  acOptionsLoaded,
  pageChanged,
  stateFilterChanged,
  queryChanged,
} = serviceAccountsSlice.actions;

export default {
  serviceAccountProfile: serviceAccountProfileReducer,
  serviceAccounts: serviceAccountsReducer,
};
