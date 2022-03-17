import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { QueryResponse } from '../../service/types';

export interface SearchPageState {
  data: {
    results?: QueryResponse;
  };
}

export const initialState: SearchPageState = {
  data: {
    results: undefined,
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
