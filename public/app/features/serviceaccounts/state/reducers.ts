import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  ApiKey,
  Role,
  ServiceAccountDTO,
  ServiceAccountFilter,
  ServiceAccountProfileState,
  ServiceAccountsState,
} from 'app/types';

// serviceAccountsProfilePage
export const initialStateProfile: ServiceAccountProfileState = {
  serviceAccount: {} as ServiceAccountDTO,
  isLoading: true,
  tokens: [] as ApiKey[],
};

export const serviceAccountProfileSlice = createSlice({
  name: 'serviceaccount',
  initialState: initialStateProfile,
  reducers: {
    serviceAccountLoaded: (state, action: PayloadAction<ServiceAccountDTO>): ServiceAccountProfileState => {
      return { ...state, serviceAccount: action.payload, isLoading: false };
    },
    serviceAccountTokensLoaded: (state, action: PayloadAction<ApiKey[]>): ServiceAccountProfileState => {
      return { ...state, tokens: action.payload, isLoading: false };
    },
  },
});

export const serviceAccountProfileReducer = serviceAccountProfileSlice.reducer;
export const { serviceAccountLoaded, serviceAccountTokensLoaded } = serviceAccountProfileSlice.actions;

// serviceAccountsListPage
export const initialStateList: ServiceAccountsState = {
  serviceAccounts: [] as ServiceAccountDTO[],
  isLoading: true,
  builtInRoles: {},
  roleOptions: [],
  serviceAccountToRemove: null,
  query: '',
  page: 0,
  perPage: 50,
  totalPages: 1,
  showPaging: false,
  filters: [{ name: 'expiredTokens', value: false }],
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
    builtInRolesLoaded: (state, action: PayloadAction<Record<string, Role[]>>): ServiceAccountsState => {
      return { ...state, builtInRoles: action.payload };
    },
    serviceAccountToRemoveLoaded: (state, action: PayloadAction<ServiceAccountDTO | null>): ServiceAccountsState => {
      return { ...state, serviceAccountToRemove: action.payload };
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
    filterChanged: (state, action: PayloadAction<ServiceAccountFilter>) => {
      const { name, value } = action.payload;

      if (state.filters.some((filter) => filter.name === name)) {
        return {
          ...state,
          filters: state.filters.map((filter) => (filter.name === name ? { ...filter, value } : filter)),
        };
      }
      return {
        ...state,
        filters: [...state.filters, action.payload],
      };
    },
  },
});
export const serviceAccountsReducer = serviceAccountsSlice.reducer;

export const {
  serviceAccountsFetchBegin,
  serviceAccountsFetchEnd,
  serviceAccountsFetched,
  acOptionsLoaded,
  builtInRolesLoaded,
  serviceAccountToRemoveLoaded,
  pageChanged,
  filterChanged,
  queryChanged,
} = serviceAccountsSlice.actions;

export default {
  serviceAccountProfile: serviceAccountProfileReducer,
  serviceAccounts: serviceAccountsReducer,
};
