import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AuthConfigState } from 'app/types';

export const initialState: AuthConfigState = {};

const authConfigSlice = createSlice({
  name: 'authConfig',
  initialState,
  reducers: {},
});

export const {} = authConfigSlice.actions;

export const authConfigReducer = authConfigSlice.reducer;

export default {
  authConfig: authConfigSlice,
};
