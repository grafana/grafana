import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { dashboardTitleChange, clearDashboard, setInputs, setGcomDashboard, setGcomError } from './reducers';
import { ThunkResult } from 'app/types';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      // store reference to grafana.com
      dispatch(setGcomDashboard(dashboard));

      if (dashboard.json && dashboard.json.__inputs) {
        const inputs: any[] = [];
        dashboard.json.__inputs.forEach((input: any) => {
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
    } catch (error) {
      dispatch(setGcomError(error.data.message || error));
    }
  };
}

export function changeDashboardTitle(title: string): ThunkResult<void> {
  return dispatch => {
    dispatch(dashboardTitleChange(title));
  };
}

export function resetDashboard(): ThunkResult<void> {
  return dispatch => {
    dispatch(clearDashboard());
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
