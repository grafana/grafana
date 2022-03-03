import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataFrameView } from '@grafana/data';

import { DashboardResult } from '../types';

export interface SearchPageState {
  dashboards: DataFrameView<DashboardResult> | null;
}

export const initialState: SearchPageState = {
  dashboards: null,
};

export const searchPageSlice = createSlice({
  name: 'searchPage',
  initialState: initialState,
  reducers: {
    fetchResults: (state, action: PayloadAction<SearchPageState>): SearchPageState => {
      return { ...action.payload };
    },
  },
});

export const { fetchResults } = searchPageSlice.actions;

export const searchPageReducer = searchPageSlice.reducer;

export default {
  searchPage: searchPageReducer,
};
