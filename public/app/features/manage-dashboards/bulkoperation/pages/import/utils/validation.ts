import { getBackendSrv } from '@grafana/runtime';

import { ImportDashboardState } from '../state/reducers';

export const importDashboard = (dash: ImportDashboardState) => {
  return getBackendSrv().post('api/dashboards/import', {
    dashboard: dash.dashboard,
    overwrite: true,
    inputs: dash.inputsToPersist,
    folderUid: dash.folderId,
  });
};
