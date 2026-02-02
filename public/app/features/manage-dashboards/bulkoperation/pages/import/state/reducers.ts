import { cloneDeep } from 'lodash';
import { Action } from 'redux';

import { DataSourceInstanceSettings } from '@grafana/data';
import {
  DashboardSource,
  type ImportDashboardDTO,
  InputType,
  LibraryPanelInputState,
  type DashboardInput,
  type DataSourceInput,
  type LibraryPanelInput,
  type DashboardInputs,
} from 'app/features/manage-dashboards/state/reducers';

import { updateVQBView } from '../../../../state/actions';
import {
  SET_DASHBOARD_INPUTS_BY_ID,
  SET_JSON_DASHBOARD,
  CLEAR_DASHBOARD_BY_ID,
  UPDATE_DASHBOARD,
  CLEAR_ALL_DASHBOARD,
} from '../actions';

interface ActionImpl extends Action {
  payload?: any;
}

interface ImportDashboardState {
  meta: { updatedAt: string; orgName: string };
  dashboard: any;
  source: DashboardSource;
  inputs?: DashboardInputs;
  dashId?: string;
  inputsToPersist?: any;
  folderId?: any;
  checked?: boolean;
}

interface ImportDashboardsState {
  dashboards: { [key: string]: ImportDashboardState };
}

const initialImportDashboardState: ImportDashboardsState = {
  dashboards: {},
};

const importReducer = (state: ImportDashboardsState, action: ActionImpl) => {
  switch (action.type) {
    case CLEAR_ALL_DASHBOARD: {
      return {
        dashboards: {},
      };
    }
    case SET_JSON_DASHBOARD: {
      const newState = { ...state };
      if (!newState.dashboards[action.payload.dashId]) {
        newState.dashboards[action.payload.dashId] = {
          dashboard: { ...action.payload.dashboard, id: null },
          meta: { updatedAt: '', orgName: '' },
          source: DashboardSource.Json,
          dashId: action.payload.dashId,
        };
      } else {
        newState.dashboards[action.payload.dashId] = {
          ...newState.dashboards[action.payload.dashId],
          dashboard: { ...action.payload.dashboard, id: null },
          meta: { updatedAt: '', orgName: '' },
          source: DashboardSource.Json,
        };
      }
      return { ...newState };
    }
    case CLEAR_DASHBOARD_BY_ID: {
      const newState = { ...state };
      if (newState.dashboards[action.payload.dashId]) {
        delete newState.dashboards[action.payload.dashId];
      }
      return { ...newState };
    }
    case SET_DASHBOARD_INPUTS_BY_ID: {
      const newState = { ...state };
      if (newState.dashboards[action.payload.dashId]) {
        newState.dashboards[action.payload.dashId] = {
          ...newState.dashboards[action.payload.dashId],
          inputs: {
            dataSources: action.payload.inputs.filter((p: any) => p.type === InputType.DataSource),
            constants: action.payload.inputs.filter((p: any) => p.type === InputType.Constant),
            // BMC code next line
            vqbViews: action.payload.inputs.filter((p: any) => p.type === InputType.View),
            libraryPanels: action.payload.libraryPanelInputs,
          },
        };
      }
      return { ...newState };
    }
    case UPDATE_DASHBOARD: {
      const newState = { ...state };
      if (newState.dashboards[action.payload.dashId]) {
        const dashInfo = newState.dashboards[action.payload.dashId];
        const dashboard = dashInfo.dashboard;
        const inputs = dashInfo.inputs;
        let inputsToPersist = [] as any[];

        // BMC Code: start
        // Need to remove the inputs as we have validation based in input on go side
        let newDashboard: any = cloneDeep(dashboard);
        if (dashboard.__inputs) {
          const newInput = dashboard.__inputs.filter((input: any) => input.type !== InputType.View);
          newDashboard.__inputs = newInput;
          updateVQBView(newDashboard, action.payload.updatedDashboard);
        }
        // BMC Code: end

        action.payload.updatedDashboard.dataSources?.forEach(
          (dataSource: DataSourceInstanceSettings, index: number) => {
            const input = inputs?.dataSources[index];
            inputsToPersist.push({
              name: input?.name,
              type: input?.type,
              pluginId: input?.pluginId,
              value: dataSource?.uid,
            });
          }
        );

        action.payload.updatedDashboard.constants?.forEach((constant: any, index: number) => {
          const input = inputs?.constants[index];

          inputsToPersist.push({
            value: constant,
            name: input?.name,
            type: input?.type,
          });
        });
        newState.dashboards[action.payload.dashId] = {
          ...dashInfo,
          dashboard: {
            ...newDashboard,
            title: action.payload.updatedDashboard.title,
            uid: action.payload.updatedDashboard.uid || dashboard.uid,
          },
          inputsToPersist,
          folderId: action.payload.updatedDashboard.folder.uid,
          checked: true,
        };
      }
      return { ...newState };
    }
    default: {
      return { ...state };
    }
  }
};

export {
  DashboardSource,
  ImportDashboardDTO,
  InputType,
  LibraryPanelInputState,
  importReducer,
  initialImportDashboardState,
};

export type {
  DashboardInput,
  DataSourceInput,
  LibraryPanelInput,
  DashboardInputs,
  ActionImpl,
  ImportDashboardState,
  ImportDashboardsState,
};
