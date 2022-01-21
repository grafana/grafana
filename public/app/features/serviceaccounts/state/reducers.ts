import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { ServiceAccountDTO, ServiceAccountProfileState, ServiceAccountsState } from 'app/types';

export const initialState: ServiceAccountsState = {
  serviceAccounts: [] as ServiceAccountDTO[],
  searchQuery: '',
  searchPage: 1,
  isLoading: true,
};

export const initialStateProfile: ServiceAccountProfileState = {
  serviceAccount: {} as ServiceAccountDTO,
  isLoading: true,
};

export const serviceAccountProfileSlice = createSlice({
  name: 'serviceaccount',
  initialState: initialStateProfile,
  reducers: {
    serviceAccountLoaded: (state, action: PayloadAction<ServiceAccountDTO>): ServiceAccountProfileState => {
      return { ...state, serviceAccount: action.payload, isLoading: false };
    },
  },
});

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

export const { serviceAccountLoaded } = serviceAccountProfileSlice.actions;

export const serviceAccountProfileReducer = serviceAccountProfileSlice.reducer;
export const serviceAccountsReducer = serviceAccountsSlice.reducer;

export default {
  serviceAccountProfile: serviceAccountProfileReducer,
  serviceAccounts: serviceAccountsReducer,
};
