import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { GrafanaThemeType } from '@grafana/data';

export interface FnGlobalState {
  FNDashboard: boolean;
  uid: string;
  slug: string;
  theme: GrafanaThemeType;
  controlsContainer: HTMLElement | null | undefined;
  pageTitle: string;
  queryParams: object;
  hiddenVariables: string[];
}

const initialState: FnGlobalState = {
  FNDashboard: false,
  uid: '',
  slug: '',
  theme: GrafanaThemeType.Light,
  controlsContainer: null,
  pageTitle: '',
  queryParams: {},
  hiddenVariables: [],
};

const fnSlice = createSlice({
  name: 'fnGlobalState',
  initialState,
  reducers: {
    setInitialMountState: (state, action: PayloadAction<FnGlobalState>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
    updateFnState: (
      state,
      action: PayloadAction<{ type: keyof FnGlobalState; payload: FnGlobalState[keyof FnGlobalState] }>
    ) => {
      const { type, payload } = action.payload;
      return {
        ...state,
        [type]: payload,
      };
    },
  },
});

export const { updateFnState, setInitialMountState } = fnSlice.actions;
export const fnSliceReducer = fnSlice.reducer;
