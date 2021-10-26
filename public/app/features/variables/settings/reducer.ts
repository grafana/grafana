import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SettingsState {
  strictPanelRefresh: boolean;
}

export const initialSettingsState: SettingsState = {
  strictPanelRefresh: false,
};

const settingsReducerSlice = createSlice({
  name: 'templating/settings',
  initialState: initialSettingsState,
  reducers: {
    setStrictPanelRefresh: (state, action: PayloadAction<boolean>) => {
      state.strictPanelRefresh = action.payload;
    },
  },
});

export const settingsReducer = settingsReducerSlice.reducer;
export const { setStrictPanelRefresh } = settingsReducerSlice.actions;
