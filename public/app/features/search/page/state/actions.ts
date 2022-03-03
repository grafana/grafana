import { ThunkResult } from 'app/types';
import { useAsync } from 'react-use';

import { getDashboardData, filterDataFrame, buildStatsTable } from '../data';
import { FETCH_RESULTS } from './actionTypes';

export const fetchResults = (query: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    console.log('getting in here???');

    const data = useAsync(getDashboardData, []);

    console.log(data, 'what is this?');
    if (!data.value?.dashboards.length || !query.length) {
      return dispatch({
        type: FETCH_RESULTS,
        payload: {
          dashboards: data.value?.dashboards,
          panels: data.value?.panels,
        },
      });
    }

    const dashboards = filterDataFrame(query, data.value!.dashboards, 'Name', 'Description', 'Tags');
    const panels = filterDataFrame(query, data.value!.panels, 'Name', 'Description', 'Type');

    console.log(dashboards, panels, 'hm');

    return dispatch({
      type: FETCH_RESULTS,
      payload: {
        dashboards,
        panels,
        panelTypes: buildStatsTable(panels.fields.find((f) => f.name === 'Type')),
        schemaVersions: buildStatsTable(dashboards.fields.find((f) => f.name === 'SchemaVersion')),
      },
    });
  };
};
