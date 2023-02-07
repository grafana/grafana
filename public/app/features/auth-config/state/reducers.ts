import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState, Settings } from 'app/types';

export const initialState: AuthConfigState = {
  settings: {},
};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {
    settingsLoaded: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
    settingsUpdated: (state, action: PayloadAction<Settings>): AuthConfigState => {
      return { ...state, settings: action.payload };
    },
  },
});

export const { settingsLoaded, settingsUpdated } = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigReducer,
};
