import { createSlice } from '@reduxjs/toolkit';

import { LibraryCredentialsState } from 'app/types';

export const initialLibraryCredentialsState: LibraryCredentialsState = {
  libraryCredentials: [],
  searchQuery: '',
  hasFetched: false,
};

const libraryCredentialsSlice = createSlice({
  name: 'libraryCredentials',
  initialState: initialLibraryCredentialsState,
  reducers: {
    libraryCredentialsLoaded: (state, action): LibraryCredentialsState => {
      return { ...state, hasFetched: true, libraryCredentials: action.payload };
    },
    setSearchQuery: (state, action): LibraryCredentialsState => {
      return { ...state, searchQuery: action.payload };
    },
  },
});

export const { setSearchQuery, libraryCredentialsLoaded } = libraryCredentialsSlice.actions;

export const libraryCredentialsReducer = libraryCredentialsSlice.reducer;

export default {
  libraryCredentials: libraryCredentialsReducer,
};
