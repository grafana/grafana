import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';

import { LibraryPanelDTO } from '../../types';

export interface LibraryPanelsViewState {
  loadingState: LoadingState;
  libraryPanels: LibraryPanelDTO[];
  searchString: string;
  totalCount: number;
  perPage: number;
  page: number;
  currentPanelId?: string;
}

export const initialLibraryPanelsViewState: LibraryPanelsViewState = {
  loadingState: LoadingState.NotStarted,
  libraryPanels: [],
  searchString: '',
  totalCount: 0,
  perPage: 10,
  page: 1,
  currentPanelId: undefined,
};

const libraryPanelsViewSlice = createSlice({
  name: 'libraryPanels/view',
  initialState: initialLibraryPanelsViewState,
  reducers: {
    initSearch: (state) => {
      state.loadingState = LoadingState.Loading;
    },
    searchCompleted: (
      state,
      action: PayloadAction<Omit<LibraryPanelsViewState, 'currentPanelId' | 'searchString' | 'loadingState'>>
    ) => {
      const { libraryPanels, page, perPage, totalCount } = action.payload;
      state.libraryPanels = libraryPanels?.filter((l) => l.uid !== state.currentPanelId);
      state.page = page;
      state.perPage = perPage;
      state.totalCount = totalCount;
      state.loadingState = LoadingState.Done;
    },
    setSearchString: (state, action: PayloadAction<Pick<LibraryPanelsViewState, 'searchString'>>) => {
      state.searchString = action.payload.searchString;
    },
    setPage: (state, action: PayloadAction<Pick<LibraryPanelsViewState, 'page'>>) => {
      state.page = action.payload.page;
    },
  },
});

export const libraryPanelsViewReducer = libraryPanelsViewSlice.reducer;
export const { initSearch, searchCompleted, setSearchString, setPage } = libraryPanelsViewSlice.actions;
