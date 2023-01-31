import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, Settings } from 'app/types';

import { selectSamlConfig } from './selectors';

export const initialState: AuthConfigState = {
  settings: {},
  samlStep: 1,
  samlSignatureAlgorithm: '',
};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {
    settingsLoaded: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    samlStateUpdated: (state): AuthConfigState => {
      return { ...state, samlSignatureAlgorithm: selectSamlConfig(state).signature_algorithm };
    },
    samlStepChanged: (state, action: PayloadAction<number>): AuthConfigState => {
      return { ...state, samlStep: action.payload };
    },
    settingsUpdated: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    setSignatureAlgorithm: (state, action: PayloadAction<string>): AuthConfigState => {
      return { ...state, samlSignatureAlgorithm: action.payload };
    },
  },
});

export const { settingsLoaded, samlStateUpdated, samlStepChanged, settingsUpdated, setSignatureAlgorithm } =
  authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
