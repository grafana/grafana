import { createSlice } from '@reduxjs/toolkit';

import { ApiKeysState } from 'app/types';

export const initialApiKeysState: ApiKeysState = {
  keys: [],
  searchQuery: '',
  hasFetched: false,
  includeExpired: false,
};

const apiKeysSlice = createSlice({
  name: 'apiKeys',
  initialState: initialApiKeysState,
  reducers: {
    apiKeysLoaded: (state, action): ApiKeysState => {
      return { ...state, hasFetched: true, keys: action.payload };
    },
    setSearchQuery: (state, action): ApiKeysState => {
      return { ...state, searchQuery: action.payload };
    },
  },
});

export const { setSearchQuery, apiKeysLoaded } = apiKeysSlice.actions;

export const apiKeysReducer = apiKeysSlice.reducer;

export default {
  apiKeys: apiKeysReducer,
};
