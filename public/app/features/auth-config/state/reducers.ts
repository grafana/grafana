import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, AuthProviderStatus, Settings, SettingsError } from 'app/types';

export const initialState: AuthConfigState = {
  settings: {},
  providerStatuses: {},
};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {
    settingsUpdated: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    providerStatusesLoaded: (state, action: PayloadAction<{ [key: string]: AuthProviderStatus }>): AuthConfigState => {
      return { ...state, providerStatuses: action.payload };
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

export const { settingsUpdated, providerStatusesLoaded, setError, resetError, setWarning, resetWarning } =
  authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
