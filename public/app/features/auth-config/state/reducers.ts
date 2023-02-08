import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, Settings, SettingsUpdateError } from 'app/types';

export const initialState: AuthConfigState = {
  settings: {},
};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {
    settingsUpdated: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    setError: (state, action: PayloadAction<SettingsUpdateError>): AuthConfigState => {
      return { ...state, updateError: action.payload };
    },
    resetError: (state): AuthConfigState => {
      return { ...state, updateError: undefined };
    },
  },
});

export const { settingsUpdated, setError, resetError } = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
