import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataFrame, DataFrameView } from '@grafana/data';

import { DashboardResult } from '../types';

export interface SearchPageState {
  data: {
    dashboards: DataFrameView<DashboardResult> | null;
    panels: DataFrame | null;
  };
}

export const initialState: SearchPageState = {
  data: {
    dashboards: null,
    panels: null,
  },
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
