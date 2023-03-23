import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, Settings, SettingsError } from 'app/types';

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
    setError: (state, action: PayloadAction<SettingsError>): AuthConfigState => {
      return { ...state, updateError: action.payload };
    },
    resetError: (state): AuthConfigState => {
      return { ...state, updateError: undefined };
    },
    setWarning: (state, action: PayloadAction<SettingsError>): AuthConfigState => {
      return { ...state, warning: action.payload };
    },
    resetWarning: (state): AuthConfigState => {
      return { ...state, warning: undefined };
    },
  },
});

export const { settingsUpdated, setError, resetError, setWarning, resetWarning } = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
