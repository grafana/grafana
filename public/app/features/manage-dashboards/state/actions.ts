import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, isFetchError } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { browseDashboardsAPI, ImportInputs } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PermissionLevelString, SearchQueryType, ThunkResult } from 'app/types';

import {
  Input,
  InputUsage,
  LibraryElementExport,
  LibraryPanel,
} from '../../dashboard/components/DashExportModal/DashboardExporter';
import { getLibraryPanel } from '../../library-panels/state/api';
import { LibraryElementDTO, LibraryElementKind } from '../../library-panels/types';
import { DashboardSearchHit } from '../../search/types';
import { DashboardJson } from '../types';

import {
  clearDashboard,
  fetchDashboard,
  fetchFailed,
  ImportDashboardDTO,
  ImportDashboardState,
  InputType,
  LibraryPanelInput,
  LibraryPanelInputState,
  setGcomDashboard,
  setInputs,
  setJsonDashboard,
  setLibraryPanelInputs,
} from './reducers';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(fetchDashboard());
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      await dispatch(processElements(dashboard.json));
      await dispatch(processGcomDashboard(dashboard));
      dispatch(processInputs());
    } catch (error) {
      dispatch(fetchFailed());
      if (isFetchError(error)) {
        dispatch(notifyApp(createErrorNotification(error.data.message || error)));
      }
    }
  };
}

export function importDashboardJson(dashboard: any): ThunkResult<void> {
  return async (dispatch) => {
    await dispatch(processElements(dashboard));
    await dispatch(processJsonDashboard(dashboard));
    dispatch(processInputs());
  };
}

const getNewLibraryPanelsByInput = (input: Input, state: ImportDashboardState): LibraryPanel[] | undefined => {
  return input?.usage?.libraryPanels?.filter((usageLibPanel) =>
    state.inputs.libraryPanels.some(
      (libPanel) => libPanel.state !== LibraryPanelInputState.Exists && libPanel.model.uid === usageLibPanel.uid
    )
  );
};

export function processDashboard(dashboardJson: DashboardJson, state: ImportDashboardState): DashboardJson {
  let inputs = dashboardJson.__inputs;
  if (!!state.inputs.libraryPanels?.length) {
    const filteredUsedInputs: Input[] = [];
    dashboardJson.__inputs?.forEach((input: Input) => {
      if (!input?.usage?.libraryPanels) {
        filteredUsedInputs.push(input);
        return;
      }

      const newLibraryPanels = getNewLibraryPanelsByInput(input, state);
      input.usage = { libraryPanels: newLibraryPanels };

      const isInputBeingUsedByANewLibraryPanel = !!newLibraryPanels?.length;
      if (isInputBeingUsedByANewLibraryPanel) {
        filteredUsedInputs.push(input);
      }
    });
    inputs = filteredUsedInputs;
  }

  return { ...dashboardJson, __inputs: inputs };
}

function processGcomDashboard(dashboard: { json: DashboardJson }): ThunkResult<void> {
  return (dispatch, getState) => {
    const state = getState().importDashboard;
    const dashboardJson = processDashboard(dashboard.json, state);
    dispatch(setGcomDashboard({ ...dashboard, json: dashboardJson }));
  };
}

function processJsonDashboard(dashboardJson: DashboardJson): ThunkResult<void> {
  return (dispatch, getState) => {
    const state = getState().importDashboard;
    const dashboard = processDashboard(dashboardJson, state);
    dispatch(setJsonDashboard(dashboard));
  };
}

function processInputs(): ThunkResult<void> {
  return (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    if (dashboard && dashboard.__inputs) {
      const inputs: any[] = [];
      dashboard.__inputs.forEach((input: any) => {
        const inputModel: any = {
          name: input.name,
          label: input.label,
          info: input.description,
          value: input.value,
          type: input.type,
          pluginId: input.pluginId,
          options: [],
        };

        inputModel.description = getDataSourceDescription(input);

        if (input.type === InputType.DataSource) {
          getDataSourceOptions(input, inputModel);
        } else if (!inputModel.info) {
          inputModel.info = 'Specify a string constant';
        }

        inputs.push(inputModel);
      });
      dispatch(setInputs(inputs));
    }
  };
}

function processElements(dashboardJson?: { __elements?: Record<string, LibraryElementExport> }): ThunkResult<void> {
  return async function (dispatch) {
    const libraryPanelInputs = await getLibraryPanelInputs(dashboardJson);
    dispatch(setLibraryPanelInputs(libraryPanelInputs));
  };
}

export async function getLibraryPanelInputs(dashboardJson?: {
  __elements?: Record<string, LibraryElementExport>;
}): Promise<LibraryPanelInput[]> {
  if (!dashboardJson || !dashboardJson.__elements) {
    return [];
  }

  const libraryPanelInputs: LibraryPanelInput[] = [];

  for (const element of Object.values(dashboardJson.__elements)) {
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

  return libraryPanelInputs;
}

export function clearLoadedDashboard(): ThunkResult<void> {
  return (dispatch) => {
    dispatch(clearDashboard());
  };
}

export function importDashboard(importDashboardForm: ImportDashboardDTO): ThunkResult<void> {
  return async (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    const inputs = getState().importDashboard.inputs;

    const inputsToPersist: ImportInputs[] = [];
    importDashboardForm.dataSources?.forEach((dataSource: DataSourceInstanceSettings, index: number) => {
      const input = inputs.dataSources[index];
      inputsToPersist.push({
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: dataSource.uid,
      });
    });

    importDashboardForm.constants?.forEach((constant, index) => {
      const input = inputs.constants[index];

      inputsToPersist.push({
        value: constant,
        name: input.name,
        type: input.type,
      });
    });

    dispatch(
      browseDashboardsAPI.endpoints.importDashboard.initiate({
        // uid: if user changed it, take the new uid from importDashboardForm,
        // else read it from original dashboard
        // by default the uid input is disabled, onSubmit ignores values from disabled inputs
        dashboard: { ...dashboard, title: importDashboardForm.title, uid: importDashboardForm.uid || dashboard.uid },
        overwrite: true,
        inputs: inputsToPersist,
        folderUid: importDashboardForm.folder.uid,
      })
    );
  };
}

const getDataSourceOptions = (input: { pluginId: string; pluginName: string }, inputModel: any) => {
  const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });

  if (sources.length === 0) {
    inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
  } else if (!inputModel.info) {
    inputModel.info = 'Select a ' + input.pluginName + ' data source';
  }
};

const getDataSourceDescription = (input: { usage?: InputUsage }): string | undefined => {
  if (!input.usage) {
    return undefined;
  }

  if (input.usage.libraryPanels) {
    const libPanelNames = input.usage.libraryPanels.reduce(
      (acc: string, libPanel, index) => (index === 0 ? libPanel.name : `${acc}, ${libPanel.name}`),
      ''
    );
    return `List of affected library panels: ${libPanelNames}`;
  }

  return undefined;
};

/** @deprecated Use RTK Query methods from features/browse-dashboards/api/browseDashboardsAPI.ts instead */
export function createFolder(payload: any) {
  return getBackendSrv().post('/api/folders', payload);
}

export const SLICE_FOLDER_RESULTS_TO = 1000;

export function searchFolders(
  query: any,
  permission?: PermissionLevelString,
  type: SearchQueryType = SearchQueryType.Folder
): Promise<DashboardSearchHit[]> {
  return getBackendSrv().get('/api/search', {
    query,
    type: type,
    permission,
    limit: SLICE_FOLDER_RESULTS_TO,
  });
}

export function getFolderByUid(uid: string): Promise<{ uid: string; title: string }> {
  return getBackendSrv().get(`/api/folders/${uid}`);
}
