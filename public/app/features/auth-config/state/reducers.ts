import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Settings } from 'app/types/settings';

import { SettingsError, AuthProviderStatus, AuthConfigState, SSOProvider } from '../types';

export const initialState: AuthConfigState = {
  settings: {},
  providerStatuses: {},
  isLoading: false,
  providers: [],
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
    loadingBegin: (state: AuthConfigState) => {
      return { ...state, isLoading: true };
    },
    loadingEnd: (state: AuthConfigState) => {
      return { ...state, isLoading: false };
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
    providersLoaded: (state, action: PayloadAction<SSOProvider[]>): AuthConfigState => {
      return { ...state, providers: action.payload };
    },
  },
});

export const {
  settingsUpdated,
  providerStatusesLoaded,
  loadingBegin,
  loadingEnd,
  setError,
  resetError,
  setWarning,
  resetWarning,
  providersLoaded,
} = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
