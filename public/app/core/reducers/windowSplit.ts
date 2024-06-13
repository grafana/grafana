import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { getAppContextService } from '@grafana/runtime';

import { StoreState } from '../../types';

type WindowSplitState = {
  secondAppId: string | undefined;
  initialContext: unknown | undefined;
};

type OpenSplitAction = {
  secondAppId: string;
  context: unknown;
};

type CloseSplitAction = {
  secondAppId: string;
};

export const initialState: WindowSplitState = {
  secondAppId: undefined,
  initialContext: undefined,
};

const slice = createSlice({
  name: 'windowSplit',
  initialState,
  reducers: {
    openSplitApp: (state, action: PayloadAction<OpenSplitAction>) => {
      getAppContextService().setContext(action.payload.context);
      return { ...state, secondAppId: action.payload.secondAppId, initialContext: action.payload.context };
    },

    closeSplitApp: (state, action: PayloadAction<CloseSplitAction>) => {
      if (state.secondAppId === action.payload.secondAppId) {
        return { ...state, secondAppId: undefined };
      }
      return state;
    },
  },
});

export const getInitialAppContext = createSelector(
  [
    (state: StoreState) => {
      return state[slice.reducerPath].initialContext;
    },
  ],
  (initialContext) => initialContext
);

export default slice;
