import { AppEvents, DataSourceInstanceSettings, DataSourceSelectItem, locationUtil } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import {
  clearDashboard,
  setInputs,
  setGcomDashboard,
  setJsonDashboard,
  InputType,
  ImportDashboardDTO,
} from './reducers';
import { updateLocation } from 'app/core/actions';
import { ThunkResult } from 'app/types';
import { appEvents } from '../../../core/core';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      dispatch(setGcomDashboard(dashboard));
      dispatch(processInputs(dashboard.json));
    } catch (error) {
      appEvents.emit(AppEvents.alertError, [error.data.message || error]);
    }
  };
}

export function importDashboardJson(dashboard: any): ThunkResult<void> {
  return async dispatch => {
    dispatch(setJsonDashboard(dashboard));
    dispatch(processInputs(dashboard));
  };
}

function processInputs(dashboardJson: any): ThunkResult<void> {
  return dispatch => {
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

export function clearLoadedDashboard(): ThunkResult<void> {
  return dispatch => {
    dispatch(clearDashboard());
  };
}

export function saveDashboard(importDashboardForm: ImportDashboardDTO): ThunkResult<void> {
  return async (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    const inputs = getState().importDashboard.inputs;

    let inputsToPersist = [] as any[];
    importDashboardForm.dataSources?.forEach((dataSource: DataSourceSelectItem, index: number) => {
      const input = inputs.dataSources[index];
      inputsToPersist.push({
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: dataSource.value,
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
      dashboard: { ...dashboard, title: importDashboardForm.title, uid: importDashboardForm.uid },
      overwrite: true,
      inputs: inputsToPersist,
      folderId: importDashboardForm.folder.id,
    });
    const dashboardUrl = locationUtil.stripBaseFromUrl(result.importedUrl);
    dispatch(updateLocation({ path: dashboardUrl }));
  };
}

const getDataSourceOptions = (input: { pluginId: string; pluginName: string }, inputModel: any) => {
  const sources = Object.values(config.datasources).filter(
    (val: DataSourceInstanceSettings) => val.type === input.pluginId
  );

  if (sources.length === 0) {
    inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
  } else if (!inputModel.info) {
    inputModel.info = 'Select a ' + input.pluginName + ' data source';
  }

  inputModel.options = sources.map(val => {
    return { name: val.name, value: val.name, meta: val.meta };
  });
};
