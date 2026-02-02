import React, { useMemo, useReducer, Dispatch, createContext, useContext } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { LibraryElementDTO, LibraryElementKind } from 'app/features/library-panels/types';

import {
  CLEAR_ALL_DASHBOARD,
  CLEAR_DASHBOARD_BY_ID,
  SET_DASHBOARD_INPUTS_BY_ID,
  SET_JSON_DASHBOARD,
  UPDATE_DASHBOARD,
} from '../actions';
import { importDashboard } from '../utils/validation';

import {
  initialImportDashboardState,
  importReducer,
  ActionImpl,
  InputType,
  ImportDashboardDTO,
  ImportDashboardState,
  LibraryPanelInput,
  LibraryPanelInputState,
} from './reducers';

export const ImportOperationContext = createContext<any>({});
export const initialImportStatus = { importAllDone: false, total: 0, success: [], failed: [] };

function importDashboardJson(dashId: string, dashboard: any, dispatch: Dispatch<ActionImpl>) {
  dispatch({ type: SET_JSON_DASHBOARD, payload: { dashId, dashboard } });
  processInputs(dashId, dashboard, dispatch);
}

async function processInputs(dashId: string, dashboardJson: any, dispatch: Dispatch<ActionImpl>) {
  if (dashboardJson && dashboardJson.__inputs) {
    const inputs: any[] = [];
    dashboardJson.__inputs.forEach((input: any) => {
      const inputModel: any = {
        name: input.name,
        label: input.label,
        info: input.description,
        value: input.value,
        type: input.type,
        pluginId: input.pluginId,
        options: [],
      };

      if (input.type === InputType.DataSource) {
        getDataSourceOptions(input, inputModel);
      } else if (input.type === InputType.View) {
        // BMC code next line
        inputModel.id = input.id;
      } else if (!inputModel.info) {
        inputModel.info = t('bmc.bulk-operations.specify-constant', 'Specify a string constant');
      }

      inputs.push(inputModel);
    });

    const libraryPanelInputs: LibraryPanelInput[] = [];
    let element: any;
    if (dashboardJson.__elements) {
      for (element of Object.values(dashboardJson.__elements)) {
        if (element.kind !== LibraryElementKind.Panel) {
          continue;
        }

        const model = element.model;
        const { type, description } = model;
        const { uid, name } = element;
        const input: LibraryPanelInput = {
          model: {
            model,
            uid,
            name,
            version: 0,
            type,
            kind: LibraryElementKind.Panel,
            description,
          } as LibraryElementDTO,
          state: LibraryPanelInputState.New,
        };

        try {
          const panelInDb = await getLibraryPanel(uid, true);
          input.state = LibraryPanelInputState.Exists;
          input.model = panelInDb;
        } catch (e: any) {
          if (e.status !== 404) {
            throw e;
          }
        }

        libraryPanelInputs.push(input);
      }
    }

    dispatch({ type: SET_DASHBOARD_INPUTS_BY_ID, payload: { dashId, inputs, libraryPanelInputs } });
  }
}

function clearLoadedDashboard(dashId: string, dispatch: Dispatch<ActionImpl>) {
  dispatch({ type: CLEAR_DASHBOARD_BY_ID, payload: { dashId } });
}

function updateDashboard(dashId: string, form: ImportDashboardDTO, dispatch: Dispatch<ActionImpl>) {
  dispatch({ type: UPDATE_DASHBOARD, payload: { dashId, updatedDashboard: form } });
}

function getImportPayload(dash: ImportDashboardState) {
  return importDashboard(dash);
}

async function importAllDashboard(dashboards: { [key: string]: ImportDashboardState }, cb?: (n: number) => void) {
  let successPer = 0;
  // eslint-disable-next-line @typescript-eslint/array-type
  const promises: Promise<any>[] = [];
  const success: string[] = [];
  const failed: string[] = [];
  for (const dash in dashboards) {
    promises.push(
      getImportPayload(dashboards[dash])
        .then((data) => {
          success.push(dash);
          return data;
        })
        .catch(() => {
          failed.push(dash);
          console.log('suppress individual error');
        })
    );
  }
  for (const p of promises) {
    p.then(() => {
      successPer++;
      cb?.(Math.floor((successPer * 100) / promises.length));
    });
  }
  return Promise.all(promises).then(() => {
    return { total: promises.length, success, failed };
  });
}

const getDataSourceOptions = (input: { pluginId: string; pluginName: string }, inputModel: any) => {
  const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });

  if (sources.length === 0) {
    inputModel.info = t('bmc.bulk-operations.datsource-not-found', 'No data sources of type {{pluginName}} found', {
      pluginName: input.pluginName,
    });
  } else if (!inputModel.info) {
    inputModel.info = t('bmc.bulk-operations.select-datasource', 'Select a {{pluginName}} data source', {
      pluginName: input.pluginName,
    });
  }
};

export const ImportOperationProvider: React.FC<any> = ({ initialState = initialImportDashboardState, children }) => {
  const [store, dispatch] = useReducer(importReducer, initialState);
  const importOperation = useMemo(
    () => ({
      importDashboardJson: (dashId: string, dashboardJson: any) => {
        importDashboardJson(dashId, dashboardJson, dispatch);
      },
      clearLoadedDashboard: (dashId: string) => {
        clearLoadedDashboard(dashId, dispatch);
      },
      updateDashboard: (dashId: string, importDashboardForm: ImportDashboardDTO) => {
        updateDashboard(dashId, importDashboardForm, dispatch);
      },
      clearAllDashboard: () => {
        dispatch({ type: CLEAR_ALL_DASHBOARD });
      },
      isImportDisabled: () => {
        for (const dash in store.dashboards) {
          if (!store.dashboards[dash].checked) {
            return true;
          }
        }
        if (Object.keys(store.dashboards).length === 0) {
          return true;
        }
        return false;
      },
      importAllDashboard: (cb?: (n: number) => void) => {
        return importAllDashboard(store.dashboards, cb);
      },
      store,
    }),
    [store, dispatch]
  );
  return <ImportOperationContext.Provider value={importOperation}>{children}</ImportOperationContext.Provider>;
};

export function useImportOperations() {
  return useContext(ImportOperationContext);
}
