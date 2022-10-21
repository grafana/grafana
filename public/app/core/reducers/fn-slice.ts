import { Theme as MuiTheme } from '@mui/material';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { merge } from 'lodash';

import { createTheme, GrafanaThemeType } from '@grafana/data';

import { DeepPartial } from '../../../../packages/grafana-data/src/themes/types';
import { GrafanaTheme } from '../../../../packages/grafana-data/src/types/theme';
import { AnyObject } from '../../fn-app/types';

export interface FnGlobalState {
  FNDashboard: boolean;
  uid: string;
  slug: string;
  mode: GrafanaThemeType.Light | GrafanaThemeType.Dark;
  theme: FnTheme;
  controlsContainer: HTMLElement | null | undefined;
  pageTitle: string;
  queryParams: AnyObject;
  hiddenVariables: string[];
}

/**
 * NOTE:
 * The initial assumption was that the MuiTheme is used.
 * Taking into account the below type (GrafanaThemeProps do not map to MuiTheme),
 * it looks like we may consider to use GrafanaTheme instead of MuiTheme (TODO)
 */
export type FnTheme = Omit<MuiTheme, OptionalThemeProp | GrafanaThemeProp> &
  Partial<Pick<MuiTheme, OptionalThemeProp>> & {
    palette: GrafanaTheme['palette'];
    shadows: GrafanaTheme['shadows'];
    typography: GrafanaTheme['typography'];
    zIndex: GrafanaTheme['zIndex'];
    breakpoints: GrafanaTheme['breakpoints'];
    spacing: GrafanaTheme['spacing'];
  };

type OptionalThemeProp = Extract<keyof MuiTheme, 'mixins' | 'transitions' | 'shape' | 'direction'>;

type GrafanaThemeProp = Extract<
  keyof MuiTheme,
  'palette' | 'shadows' | 'typography' | 'zIndex' | 'breakpoints' | 'spacing'
>;

const INITIAL_MODE = GrafanaThemeType.Light;
const INITIAL_THEME = createTheme({ colors: { mode: INITIAL_MODE } });

const initialState: FnGlobalState = {
  FNDashboard: false,
  uid: '',
  slug: '',
  mode: INITIAL_MODE,
  theme: INITIAL_THEME.v1,
  controlsContainer: null,
  pageTitle: '',
  queryParams: {},
  hiddenVariables: [],
};

const fnSlice = createSlice({
  name: 'fnGlobalState',
  initialState,
  reducers: {
    setInitialMountState: (state, payload: PayloadAction<FnGlobalState>) => merge({}, state, payload),
    updateFnState: (
      state,
      action: PayloadAction<{ type: keyof FnGlobalState; payload: DeepPartial<FnGlobalState[keyof FnGlobalState]> }>
    ) => {
      const { type, payload } = action.payload;

      return {
        ...state,
        [type]: merge({}, state[type], payload),
      };
    },
  },
});

export const { updateFnState, setInitialMountState } = fnSlice.actions;
export const fnSliceReducer = fnSlice.reducer;
