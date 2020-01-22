import { getBackendSrv } from '@grafana/runtime';
import { setGcomDashboard, setGcomError } from './reducers';
import { ThunkResult } from 'app/types';

export function getGcomDashboard(id: string): ThunkResult<void> {
  return async dispatch => {
    try {
      const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${id}`);
      console.log(dashboard);
      // store reference to grafana.com
      dashboard.json.gnetId = dashboard.id;
      dispatch(setGcomDashboard(dashboard.json));
    } catch (error) {
      dispatch(setGcomError(error.data.message || error));
    }
  };
}
