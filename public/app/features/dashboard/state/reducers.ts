import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { PanelPlugin } from '@grafana/data';
import { AngularComponent } from '@grafana/runtime';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardInitError, DashboardInitPhase, DashboardState } from 'app/types';

import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';
import { cleanUpDashboardAndVariables, fetchDashboardPermissions } from './actions';

export const initialDash = {
  initPhase: DashboardInitPhase.NotStarted,
  getModel: () => null,
  permissions: [],
  initError: null,
};

export const initialState: DashboardState = {
  byKey: {},
  currentKey: null,
};

const dashboardSlice = createSlice({
  name: 'dashboards',
  initialState,
  reducers: {
    dashboardInitFetching: (state, { payload: { key } }: PayloadAction<{ key: string }>) => {
      const dash = state.byKey[key] ?? initialDash;
      state.byKey = {
        [key]: {
          ...dash,
          initPhase: DashboardInitPhase.Fetching,
        },
      };
      state.currentKey = key;
    },
    dashboardInitServices: (state, { payload: { key } }: PayloadAction<{ key: string }>) => {
      const dash = state.byKey[key] ?? initialDash;
      state.byKey = {
        [key]: {
          ...dash,
          initPhase: DashboardInitPhase.Services,
        },
      };
      state.currentKey = key;
    },
    dashboardInitCompleted: (state, action: PayloadAction<{ dash: DashboardModel; key: string }>) => {
      state.byKey = {
        [action.payload.key]: {
          getModel: () => action.payload.dash,
          initPhase: DashboardInitPhase.Completed,
          permissions: [],
          initError: null,
        },
      };
      state.currentKey = action.payload.key;
    },
    dashboardInitFailed: (
      state,
      { payload: { key, ...rest } }: PayloadAction<{ key: string } & DashboardInitError>
    ) => {
      const dash = state.byKey[key] ?? initialDash;
      state.byKey = {
        [key]: {
          ...dash,
          initPhase: DashboardInitPhase.Failed,
          initError: rest,
          getModel: () => {
            return new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false });
          },
        },
      };
      state.currentKey = key;
    },
    addPanel: (state, action: PayloadAction<PanelModel>) => {
      //state.panels[action.payload.id] = { pluginId: action.payload.type };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardPermissions.fulfilled, (state, { payload }) => {
        state.byKey[payload.key].permissions = processAclItems(payload.dashboardAclDTOs);
      })
      .addCase(cleanUpDashboardAndVariables.fulfilled, (state, { payload }) => {
        const dash = state.byKey[payload.key];
        dash.initPhase = DashboardInitPhase.NotStarted;
        dash.initError = null;
        dash.getModel = () => null;
      });
  },
});

export const selectCurrentDashboard = (state: DashboardState) => {
  return state.currentKey ? state.byKey[state.currentKey] : initialDash;
};

export const selectById = (state: DashboardState, id: number) => {
  Object.values(state.byKey).find((d) => d.getModel()?.id === id);
};

export interface PanelModelAndPluginReadyPayload {
  panelId: number;
  plugin: PanelPlugin;
}

export interface SetPanelAngularComponentPayload {
  panelId: number;
  angularComponent: AngularComponent | null;
}

export interface SetPanelInstanceStatePayload {
  panelId: number;
  value: any;
}

export const { dashboardInitFetching, dashboardInitFailed, dashboardInitCompleted, dashboardInitServices, addPanel } =
  dashboardSlice.actions;

export const dashboardReducer = dashboardSlice.reducer;

export default {
  dashboards: dashboardReducer,
};
