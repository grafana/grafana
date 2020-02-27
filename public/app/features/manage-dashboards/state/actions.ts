import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import {
  clearDashboard,
  setInputs,
  setGcomDashboard,
  setJsonDashboard,
  setGcomError,
  dashboardUidExists,
  dashboardTitleExists,
} from './reducers';
import validationSrv from '../services/ValidationSrv';
import { ThunkResult } from 'app/types';
import { updateLocation } from '../../../core/actions';
import locationUtil from '../../../core/utils/location_util';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      dispatch(setGcomDashboard(dashboard));
      dispatch(processInputs(dashboard.json));
    } catch (error) {
      dispatch(setGcomError(error.data.message || error));
    }
  };
}

export function importDashboardJson(dashboard: any): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .get(`/api/dashboards/uid/${dashboard.uid}`)
      .then(result => {
        dispatch(dashboardUidExists(result));
      })
      .catch(error => {
        error.isHandled = true;
      });

    dispatch(validateDashboardTitle(dashboard.title));

    dispatch(setJsonDashboard(dashboard));
    dispatch(processInputs(dashboard));
  };
}

export function validateDashboardTitle(dashboardName: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const routeParams = getStore().location.routeParams;
    const folderId = routeParams.folderId ? Number(routeParams.folderId) : 0 || null;

    await validationSrv
      .validateNewDashboardName(folderId, dashboardName)
      .then(() => {
        dispatch(dashboardTitleExists({ state: false, error: '' }));
      })
      .catch(error => {
        if (error.type === 'EXISTING') {
          dispatch(dashboardTitleExists({ state: true, error: error.message }));
        }
      });
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

        if (input.type === 'datasource') {
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

export function validateUid(uid: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv()
      .get(`/api/dashboards/uid/${uid}`)
      .then(existingDashboard => {
        dispatch(dashboardUidExists({ state: true, dashboard: existingDashboard }));
      })
      .catch(error => {
        error.isHandled = true;
        dispatch(dashboardUidExists({ state: false }));
      });
  };
}

export function resetDashboard(): ThunkResult<void> {
  return dispatch => {
    dispatch(clearDashboard());
  };
}

export function saveDashboard(title: string, uid: string, folderId: number): ThunkResult<void> {
  return async (dispatch, getState) => {
    const dashboard = getState().importDashboard.dashboard;
    const inputs = getState().importDashboard.inputs;

    const inputsToPersist = inputs.map((input: any) => {
      return {
        name: input.name,
        type: input.type,
        pluginId: input.pluginId,
        value: input.value,
      };
    });

    const result = await getBackendSrv().post('api/dashboards/import', {
      dashboard: { ...dashboard, title, uid },
      overwrite: true,
      inputs: inputsToPersist,
      folderId,
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
