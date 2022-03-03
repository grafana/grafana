import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DataFrame } from '@grafana/data';
export interface SearchPageState {
  dashboards: DataFrame;
  panels: DataFrame;
  panelTypes?: DataFrame;
  schemaVersions?: DataFrame;
}

export const initialState: SearchPageState = {
  dashboards: {} as DataFrame,
  panels: {} as DataFrame,
  panelTypes: undefined,
  schemaVersions: undefined,
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
