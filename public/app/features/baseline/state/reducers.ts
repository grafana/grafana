import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BaselineDTO } from 'app/types';

export interface BaselineEntryState {
  baselineEntries: BaselineDTO[];
  baselineEntriesAreLoading: boolean;
  isUpdating: boolean;
}

export const initialBaselineEntryState: BaselineEntryState = {
  baselineEntries: [],
  baselineEntriesAreLoading: false,
  isUpdating: true,
};

export const slice = createSlice({
  name: 'baseline/entries',
  initialState: initialBaselineEntryState,
  reducers: {
    setUpdating: (state, action: PayloadAction<{ updating: boolean }>) => {
      console.log(`[isUpdating] ${action.payload.updating}`);
      state.isUpdating = action.payload.updating;
    },
    initLoadingBaselineEntries: (state, action: PayloadAction<undefined>) => {
      state.baselineEntriesAreLoading = true;
    },
    baselineEntriesLoaded: (state, action: PayloadAction<{ baselineEntries: BaselineDTO[] }>) => {
      state.baselineEntries = action.payload.baselineEntries;
      state.baselineEntriesAreLoading = false;
    },
  },
});

export const { setUpdating, initLoadingBaselineEntries, baselineEntriesLoaded } = slice.actions;

export const userReducer = slice.reducer;
export default { user: slice.reducer };
