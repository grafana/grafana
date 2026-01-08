import { DataSourceRef } from '@grafana/schema/dist/esm/common/common.gen';
import { getDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';

export const dashboardReloadSpy = jest.spyOn(getDashboardScenePageStateManager(), 'reloadDashboard');

export const getDatasource = async (ref: DataSourceRef) => {
  if (ref.uid === '-- Grafana --') {
    return {
      id: 1,
      uid: '-- Grafana --',
      name: 'grafana',
      type: 'grafana',
      meta: {
        id: 'grafana',
      },
    };
  }

  return {
    meta: {
      id: 'grafana-testdata-datasource',
    },
    name: 'grafana-testdata-datasource',
    type: 'grafana-testdata-datasource',
    uid: 'gdev-testdata',
    getRef: () => {
      return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
    },
  };
};

export const getInstanceSettings = () => ({
  id: 1,
  uid: 'gdev-testdata',
  name: 'testDs1',
  type: 'grafana-testdata-datasource',
  meta: {
    id: 'grafana-testdata-datasource',
  },
});
