import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SettingsState {
  strictPanelRefreshMode: boolean;
}

export const initialSettingsState: SettingsState = {
  strictPanelRefreshMode: false,
};

const settingsReducerSlice = createSlice({
  name: 'templating/settings',
  initialState: initialSettingsState,
  reducers: {
    setStrictPanelRefresh: (state, action: PayloadAction<boolean>) => {
      state.strictPanelRefreshMode = action.payload;
    },
  },
});

export const settingsReducer = settingsReducerSlice.reducer;
export const { setStrictPanelRefresh } = settingsReducerSlice.actions;
