import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { SupportBundlesState, SupportBundle, SupportBundleCollector } from 'app/types/supportBundles';

export const initialState: SupportBundlesState = {
  supportBundles: [],
  isLoading: false,
  supportBundleCollectors: [],
  createBundlePageLoading: false,
  loadBundlesError: '',
  createBundleError: '',
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
    collectorsFetchBegin: (state): SupportBundlesState => {
      return { ...state, createBundlePageLoading: true };
    },
    collectorsFetchEnd: (state): SupportBundlesState => {
      return { ...state, createBundlePageLoading: false };
    },
    supportBundleCollectorsLoaded: (state, action: PayloadAction<SupportBundleCollector[]>): SupportBundlesState => {
      return { ...state, supportBundleCollectors: action.payload, createBundlePageLoading: false };
    },
    setLoadBundleError: (state, action: PayloadAction<string>): SupportBundlesState => {
      return { ...state, loadBundlesError: action.payload, supportBundleCollectors: [] };
    },
    setCreateBundleError: (state, action: PayloadAction<string>): SupportBundlesState => {
      return { ...state, createBundleError: action.payload };
    },
  },
});

export const {
  supportBundlesLoaded,
  fetchBegin,
  fetchEnd,
  supportBundleCollectorsLoaded,
  collectorsFetchBegin,
  collectorsFetchEnd,
  setLoadBundleError,
  setCreateBundleError,
} = supportBundlesSlice.actions;

export const supportBundlesReducer = supportBundlesSlice.reducer;

export default {
  supportBundles: supportBundlesReducer,
};
