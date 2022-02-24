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
  filters: [{ name: 'Expired', value: true }],
  searchPage: 1,
  searchQuery: '',
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
    serviceAccountsLoaded: (state, action: PayloadAction<ServiceAccountsFetched>): ServiceAccountsState => {
      console.log(`state`);
      console.log(state);
      console.log(`action`);
      console.log(action);
      const { totalCount, perPage, ...rest } = action.payload;
      const totalPages = Math.ceil(totalCount / perPage);

      console.log(`action.payload`);
      console.log(action.payload);
      console.log(`rest`);
      console.log(rest);
      return {
        ...state,
        ...rest,
        totalPages,
        perPage,
        showPaging: totalPages > 1,
        isLoading: false,
      };
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
    setServiceAccountsSearchQuery: (state, action: PayloadAction<string>): ServiceAccountsState => {
      // reset searchPage otherwise search results won't appear
      return { ...state };
    },
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
  serviceAccountsLoaded,
  serviceAccountsFetchEnd,
  acOptionsLoaded,
  builtInRolesLoaded,
  serviceAccountToRemoveLoaded,
  setServiceAccountsSearchQuery,
  filterChanged,
} = serviceAccountsSlice.actions;

export default {
  serviceAccountProfile: serviceAccountProfileReducer,
  serviceAccounts: serviceAccountsReducer,
};
