import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type AppSidecarState = {
  // Right now this only supports opening second app in a context of memory router so we have to explicitly say
  // what to open. Later this would make sense to get from the URL
  appId: string | undefined;
};

type OpenAppAction = {
  appId: string;
};

type CloseAppAction = {
  appId: string;
};

export const initialState: AppSidecarState = {
  appId: undefined,
};

const slice = createSlice({
  name: 'appSidecar',
  initialState,
  reducers: {
    openApp: (state, action: PayloadAction<OpenAppAction>) => {
      return { ...state, appId: action.payload.appId };
    },

    closeApp: (state, action: PayloadAction<CloseAppAction>) => {
      if (state.appId === action.payload.appId) {
        return { ...state, appId: undefined };
      }
      return state;
    },
  },
});

export default slice;
