import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ServiceAccountDTO, ServiceAccountsState } from 'app/types';

export const initialState: ServiceAccountsState = {
  serviceAccounts: [] as ServiceAccountDTO[],
  searchQuery: '',
  searchPage: 1,
  isLoading: true,
};

const serviceAccountsSlice = createSlice({
  name: 'serviceaccounts',
  initialState,
  reducers: {
    serviceAccountsLoaded: (state, action: PayloadAction<ServiceAccountDTO[]>): ServiceAccountsState => {
      return { ...state, isLoading: false, serviceAccounts: action.payload };
    },
    setServiceAccountsSearchQuery: (state, action: PayloadAction<string>): ServiceAccountsState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, searchPage: initialState.searchPage };
    },
    setServiceAccountsSearchPage: (state, action: PayloadAction<number>): ServiceAccountsState => {
      return { ...state, searchPage: action.payload };
    },
  },
});

export const {
  setServiceAccountsSearchQuery,
  setServiceAccountsSearchPage,
  serviceAccountsLoaded,
} = serviceAccountsSlice.actions;

export const serviceAccountsReducer = serviceAccountsSlice.reducer;

export default {
  serviceAccounts: serviceAccountsReducer,
};
