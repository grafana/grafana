import { getBackendSrv } from '@grafana/runtime';
import { setGcomDashboard, setGcomError } from './reducers';
import { ThunkResult } from 'app/types';

export function fetchGcomDashboard(id: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      // store reference to grafana.com
      dispatch(setGcomDashboard(dashboard));
    } catch (error) {
      dispatch(setGcomError(error.data.message || error));
    }
  };
}
