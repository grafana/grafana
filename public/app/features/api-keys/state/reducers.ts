import { createSlice } from '@reduxjs/toolkit';

import { ApiKeysState } from 'app/types';

export const initialApiKeysState: ApiKeysState = {
  hasFetched: false,
  includeExpired: false,
  keys: [],
  keysIncludingExpired: [],
  searchQuery: '',
};

const apiKeysSlice = createSlice({
  name: 'apiKeys',
  initialState: initialApiKeysState,
  reducers: {
    apiKeysLoaded: (state, action): ApiKeysState => {
      const { keys, keysIncludingExpired } = action.payload;
      const includeExpired =
        action.payload.keys.length === 0 && action.payload.keysIncludingExpired.length > 0
          ? true
          : state.includeExpired;
      return { ...state, hasFetched: true, keys, keysIncludingExpired, includeExpired };
    },
    setSearchQuery: (state, action): ApiKeysState => {
      return { ...state, searchQuery: action.payload };
    },
    includeExpiredToggled: (state): ApiKeysState => {
      return { ...state, includeExpired: !state.includeExpired };
    },
    isFetching: (state): ApiKeysState => {
      return { ...state, hasFetched: false };
    },
  },
});

export const { apiKeysLoaded, includeExpiredToggled, isFetching, setSearchQuery } = apiKeysSlice.actions;

export const apiKeysReducer = apiKeysSlice.reducer;

export default {
  apiKeys: apiKeysReducer,
};
