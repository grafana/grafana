import { DataFrameView } from '@grafana/data';

import { ThunkResult } from 'app/types';
import { getDashboardData, filterDataFrame } from '../data';
import { DashboardResult } from '../types';
import { fetchResults } from './reducers';

export const loadResults = (query: string): ThunkResult<void> => {
  return async (dispatch) => {
    const data = await getDashboardData();

    if (!data.dashboards || !data.panels) {
      return;
    }

    if (!data.dashboards.length || !query.length) {
      return dispatch(
        fetchResults({
          data: {
            dashboards: new DataFrameView<DashboardResult>(data.dashboards),
            panels: data.panels,
          },
        })
      );
    }

    const dashboards = filterDataFrame(query, data.dashboards, 'Name', 'Description', 'Tags');
    const panels = filterDataFrame(query, data.panels, 'Name', 'Description', 'Type');

    return dispatch(
      fetchResults({
        data: {
          dashboards: new DataFrameView<DashboardResult>(dashboards),
          panels: panels,
        },
      })
    );
  };
};
