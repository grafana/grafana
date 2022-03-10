import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootStorageMeta } from './types';

export interface StoragePageState {
  selectedStorage?: RootStorageMeta;
}

const initialState: StoragePageState = {
  selectedStorage: undefined,
};

export const storagePageSlice = createSlice({
  name: 'storagePage',
  initialState,
  reducers: {
    setSelectedStorage: (state, action: PayloadAction<RootStorageMeta>) => {
      state.selectedStorage = action.payload;
    },
  },
});

export const { setSelectedStorage } = storagePageSlice.actions;

export default storagePageSlice.reducer;
