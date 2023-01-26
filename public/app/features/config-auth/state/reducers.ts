import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, Settings } from 'app/types';

export const initialState: AuthConfigState = {
  settings: {},
  samlStep: 0,
};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {
    settingsLoaded: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    samlStepChanged: (state, action: PayloadAction<number>): AuthConfigState => {
      return { ...state, samlStep: action.payload };
    },
  },
});

export const { settingsLoaded, samlStepChanged } = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
