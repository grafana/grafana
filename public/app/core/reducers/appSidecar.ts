import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * A state for the "sidecar" feature which allows to open a second app so 2 apps can be rendered in the same time. At
 * this moment what is rendered in a sidecar is controlled fully in this state and there is no URL support for now.
 */
type AppSidecarState = {
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
