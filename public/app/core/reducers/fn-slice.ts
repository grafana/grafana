import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WritableDraft } from 'immer/dist/internal';

import { GrafanaThemeType } from '@grafana/data';

import { AnyObject } from '../../fn-app/types';

export interface FnGlobalState {
  FNDashboard: boolean;
  uid: string;
  slug: string;
  mode: GrafanaThemeType.Light | GrafanaThemeType.Dark;
  controlsContainer: HTMLElement | null | undefined;
  pageTitle: string;
  queryParams: AnyObject;
  hiddenVariables: string[];
}

const INITIAL_MODE = GrafanaThemeType.Light;

const initialState: FnGlobalState = {
  FNDashboard: false,
  uid: '',
  slug: '',
  mode: INITIAL_MODE,
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
      return { ...state, ...action.payload };
    },
    updateFnState: (
      state: WritableDraft<FnGlobalState>,
      action: PayloadAction<{ type: keyof FnGlobalState; payload: FnGlobalState[keyof FnGlobalState] }>
    ) => {
      const { type, payload } = action;

      return {
        ...state,
        [type]: payload,
      };
    },
  },
});

export const { updateFnState, setInitialMountState } = fnSlice.actions;
export const fnSliceReducer = fnSlice.reducer;
