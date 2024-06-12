import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type WindowSplitState = {
  secondAppId: string | undefined;
};

type OpenSplitAction = {
  secondAppId: string;
};

export const initialState: WindowSplitState = {
  secondAppId: undefined,
};

export default createSlice({
  name: 'windowSplit',
  initialState,
  reducers: {
    openSplitApp: (state, action: PayloadAction<OpenSplitAction>) => {
      return { ...state, secondAppId: action.payload.secondAppId };
    },

    closeSplitApp: (state, action: PayloadAction<OpenSplitAction>) => {
      if (state.secondAppId === action.payload.secondAppId) {
        return { ...state, secondAppId: undefined };
      }
      return state;
    },
  },
});
