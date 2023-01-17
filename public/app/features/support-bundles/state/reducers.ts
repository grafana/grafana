import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { SupportBundle, SupportBundlesState } from 'app/types';

export const initialState: SupportBundlesState = {
  supportBundles: [],
  isLoading: false,
};

const supportBundlesSlice = createSlice({
  name: 'supportBundles',
  initialState,
  reducers: {
    supportBundlesLoaded: (state, action: PayloadAction<SupportBundle[]>): SupportBundlesState => {
      return { ...state, supportBundles: action.payload, isLoading: false };
    },
    fetchBegin: (state): SupportBundlesState => {
      return { ...state, isLoading: true };
    },
    fetchEnd: (state): SupportBundlesState => {
      return { ...state, isLoading: false };
    },
  },
});

export const { supportBundlesLoaded, fetchBegin, fetchEnd } = supportBundlesSlice.actions;

export const supportBundlesReducer = supportBundlesSlice.reducer;

export default {
  supportBundles: supportBundlesReducer,
};
