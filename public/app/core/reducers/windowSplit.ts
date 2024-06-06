import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type WindowSplitState = {
  secondAppId: string | undefined;
};

type OpenSplitAction = {
  secondAppId: string;
};

export const initialState: WindowSplitState = {
  secondAppId: 'grafana-querylibrary-app',
};

export default createSlice({
  name: 'windowSplit',
  initialState,
  reducers: {
    openSplitApp: (state, action: PayloadAction<OpenSplitAction>) => {
      return { ...state, secondAppId: action.payload.secondAppId };
    },
    closeSplitApp: (state) => {
      return { ...state, secondAppId: undefined };
    },
  },
});
