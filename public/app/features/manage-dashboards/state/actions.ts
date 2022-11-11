import { DataSourceInstanceSettings, locationUtil } from '@grafana/data';
import { getDataSourceSrv, locationService, getBackendSrv, isFetchError } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DashboardDTO, FolderInfo, PermissionLevelString, ThunkResult } from 'app/types';

import { LibraryElementExport } from '../../dashboard/components/DashExportModal/DashboardExporter';
import { getLibraryPanel } from '../../library-panels/state/api';
import { LibraryElementDTO, LibraryElementKind } from '../../library-panels/types';
import { DashboardSearchHit } from '../../search/types';
import { DeleteDashboardResponse } from '../types';

import {
  clearDashboard,
  fetchDashboard,
  fetchFailed,
  ImportDashboardDTO,
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
      dispatch(setGcomDashboard(dashboard));
      dispatch(processInputs(dashboard.json));
      dispatch(processElements(dashboard.json));
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
    dispatch(setJsonDashboard(dashboard));
    dispatch(processInputs(dashboard));
    dispatch(processElements(dashboard));
  };
}

function processInputs(dashboardJson: any): ThunkResult<void> {
  return (dispatch) => {
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
    if (!dashboardJson || !dashboardJson.__elements) {
      return;
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
          meta: {},
          id: 0,
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

    dispatch(setLibraryPanelInputs(libraryPanelInputs));
  };
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

    let inputsToPersist = [] as any[];
    importDashboardForm.dataSources?.forEach((dataSource: DataSourceInstanceSettings, index: number) => {
      const input = inputs.dataSources[index];
      inputsToPersist.push({
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: dataSource.uid,
      });
    });

    importDashboardForm.constants?.forEach((constant: any, index: number) => {
      const input = inputs.constants[index];

      inputsToPersist.push({
        value: constant,
        name: input.name,
        type: input.type,
      });
    });

    const result = await getBackendSrv().post('api/dashboards/import', {
      // uid: if user changed it, take the new uid from importDashboardForm,
      // else read it from original dashboard
      // by default the uid input is disabled, onSubmit ignores values from disabled inputs
      dashboard: { ...dashboard, title: importDashboardForm.title, uid: importDashboardForm.uid || dashboard.uid },
      overwrite: true,
      inputs: inputsToPersist,
      folderId: importDashboardForm.folder.id,
    });

    const dashboardUrl = locationUtil.stripBaseFromUrl(result.importedUrl);
    locationService.push(dashboardUrl);
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

export function moveDashboards(dashboardUids: string[], toFolder: FolderInfo) {
  const tasks = [];

  for (const uid of dashboardUids) {
    tasks.push(createTask(moveDashboard, true, uid, toFolder));
  }

  return executeInOrder(tasks).then((result: any) => {
    return {
      totalCount: result.length,
      successCount: result.filter((res: any) => res.succeeded).length,
      alreadyInFolderCount: result.filter((res: any) => res.alreadyInFolder).length,
    };
  });
}

async function moveDashboard(uid: string, toFolder: FolderInfo) {
  const fullDash: DashboardDTO = await getBackendSrv().get(`/api/dashboards/uid/${uid}`);

  if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
    return { alreadyInFolder: true };
  }

  const options = {
    dashboard: fullDash.dashboard,
    folderId: toFolder.id,
    overwrite: false,
  };

  try {
    await saveDashboard(options);
    return { succeeded: true };
  } catch (err) {
    if (isFetchError(err)) {
      if (err.data?.status !== 'plugin-dashboard') {
        return { succeeded: false };
      }

      err.isHandled = true;
    }
    options.overwrite = true;

    try {
      await saveDashboard(options);
      return { succeeded: true };
    } catch (e) {
      return { succeeded: false };
    }
  }
}

function createTask(fn: (...args: any[]) => Promise<any>, ignoreRejections: boolean, ...args: any[]) {
  return async (result: any) => {
    try {
      const res = await fn(...args);
      return Array.prototype.concat(result, [res]);
    } catch (err) {
      if (ignoreRejections) {
        return result;
      }

      throw err;
    }
  };
}

export function deleteFoldersAndDashboards(folderUids: string[], dashboardUids: string[]) {
  const tasks = [];

  for (const folderUid of folderUids) {
    tasks.push(createTask(deleteFolder, true, folderUid, true));
  }

  for (const dashboardUid of dashboardUids) {
    tasks.push(createTask(deleteDashboard, true, dashboardUid, true));
  }

  return executeInOrder(tasks);
}

export function saveDashboard(options: SaveDashboardCommand) {
  dashboardWatcher.ignoreNextSave();

  return getBackendSrv().post('/api/dashboards/db/', {
    dashboard: options.dashboard,
    message: options.message ?? '',
    overwrite: options.overwrite ?? false,
    folderId: options.folderId,
  });
}

function deleteFolder(uid: string, showSuccessAlert: boolean) {
  return getBackendSrv().delete(`/api/folders/${uid}?forceDeleteRules=false`, undefined, { showSuccessAlert });
}

export function createFolder(payload: any) {
  return getBackendSrv().post('/api/folders', payload);
}

export function searchFolders(
  query: any,
  permission?: PermissionLevelString,
  withAccessControl = false
): Promise<DashboardSearchHit[]> {
  return getBackendSrv().get('/api/search', {
    query,
    type: 'dash-folder',
    permission,
    accesscontrol: withAccessControl,
  });
}

export function getFolderById(id: number): Promise<{ id: number; title: string }> {
  return getBackendSrv().get(`/api/folders/id/${id}`);
}

export function deleteDashboard(uid: string, showSuccessAlert: boolean) {
  return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${uid}`, { showSuccessAlert });
}

function executeInOrder(tasks: any[]) {
  return tasks.reduce((acc, task) => {
    return Promise.resolve(acc).then(task);
  }, []);
}
