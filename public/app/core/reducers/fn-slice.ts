import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WritableDraft } from 'immer/dist/internal';

import { GrafanaThemeType } from '@grafana/data';
import { dispatch } from 'app/store/store';

import { AnyObject } from '../../fn-app/types';

export interface FnGlobalState {
  FNDashboard: boolean;
  uid: string;
  slug: string;
  mode: GrafanaThemeType.Light | GrafanaThemeType.Dark;
  controlsContainer: string | null;
  pageTitle: string;
  queryParams: AnyObject;
  hiddenVariables: string[];
}

export type UpdateFNGlobalStateAction = PayloadAction<{
  type: keyof FnGlobalState;
  payload: FnGlobalState[keyof FnGlobalState];
}>;

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
    setInitialMountState: (state, action: PayloadAction<Omit<FnGlobalState, 'hiddenVariables'>>) => {
      return { ...state, ...action.payload };
    },
    updateFnState: (state: WritableDraft<FnGlobalState>, action: UpdateFNGlobalStateAction) => {
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

export const updateFNGlobalState = (
  type: keyof FnGlobalState,
  payload: UpdateFNGlobalStateAction['payload']['payload']
): void => {
  dispatch(
    updateFnState({
      type,
      payload,
    })
  );
};
