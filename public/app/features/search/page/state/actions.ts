import { ThunkResult } from 'app/types';
import { useAsync } from 'react-use';

import { getDashboardData, filterDataFrame, buildStatsTable } from '../data';
import { fetchResults } from './reducers';

export const loadResults = (query: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const data = await useAsync(getDashboardData, []);

    if (!data.value?.dashboards || !data.value?.panels) {
      return;
    }

    if (!data.value?.dashboards.length || !query.length) {
      return dispatch(
        fetchResults({
          dashboards: data.value!.dashboards,
          panels: data.value!.panels,
        })
      );
    }

    const dashboards = filterDataFrame(query, data.value!.dashboards, 'Name', 'Description', 'Tags');
    const panels = filterDataFrame(query, data.value!.panels, 'Name', 'Description', 'Type');

    return dispatch(
      fetchResults({
        dashboards,
        panels,
        panelTypes: buildStatsTable(panels.fields.find((f) => f.name === 'Type')),
        schemaVersions: buildStatsTable(dashboards.fields.find((f) => f.name === 'SchemaVersion')),
      })
    );
  };
};
