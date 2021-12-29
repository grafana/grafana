import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { OrgServiceaccount, ServiceaccountsState } from 'app/types';

export const initialState: ServiceaccountsState = {
  serviceaccounts: [] as OrgServiceaccount[],
  searchQuery: '',
  searchPage: 1,
  hasFetched: false,
};

const serviceaccountsSlice = createSlice({
  name: 'serviceaccounts',
  initialState,
  reducers: {
    serviceaccountsLoaded: (state, action: PayloadAction<OrgServiceaccount[]>): ServiceaccountsState => {
      return { ...state, hasFetched: true, serviceaccounts: action.payload };
    },
    setserviceaccountsSearchQuery: (state, action: PayloadAction<string>): ServiceaccountsState => {
      // reset searchPage otherwise search results won't appear
      return { ...state, searchQuery: action.payload, searchPage: initialState.searchPage };
    },
    setserviceaccountsSearchPage: (state, action: PayloadAction<number>): ServiceaccountsState => {
      return { ...state, searchPage: action.payload };
    },
  },
});

export const {
  setserviceaccountsSearchQuery,
  setserviceaccountsSearchPage,
  serviceaccountsLoaded,
} = serviceaccountsSlice.actions;

export const serviceaccountsReducer = serviceaccountsSlice.reducer;

export default {
  serviceaccounts: serviceaccountsReducer,
};
