import coreModule from 'app/core/core_module';
import { appEvents } from 'app/core/app_events';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';
import { CoreEvents, DashboardMeta } from 'app/types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { backendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { promiseToDigest } from '../../../core/utils/promiseToDigest';

export class DashboardSrv {
  dashboard: DashboardModel;

  /** @ngInject */
  constructor(private $rootScope: GrafanaRootScope) {
    appEvents.on(CoreEvents.removePanel, this.onRemovePanel);
  }

  create(dashboard: any, meta: DashboardMeta) {
    return new DashboardModel(dashboard, meta);
  }

  setCurrent(dashboard: DashboardModel) {
    this.dashboard = dashboard;
  }

  getCurrent(): DashboardModel {
    return this.dashboard;
  }

  onRemovePanel = (panelId: number) => {
    const dashboard = this.getCurrent();
    removePanel(dashboard, dashboard.getPanelById(panelId), true);
  };

  saveJSONDashboard(json: string) {
    const parsedJson = JSON.parse(json);
    return getBackendSrv().saveDashboard(parsedJson, {
      folderId: this.dashboard.meta.folderId || parsedJson.folderId,
    });
  }

  starDashboard(dashboardId: string, isStarred: any) {
    let promise;

    if (isStarred) {
      promise = promiseToDigest(this.$rootScope)(
        backendSrv.delete('/api/user/stars/dashboard/' + dashboardId).then(() => {
          return false;
        })
      );
    } else {
      promise = promiseToDigest(this.$rootScope)(
        backendSrv.post('/api/user/stars/dashboard/' + dashboardId).then(() => {
          return true;
        })
      );
    }

    return promise.then((res: boolean) => {
      if (this.dashboard && this.dashboard.id === dashboardId) {
        this.dashboard.meta.isStarred = res;
      }
      return res;
    });
  }
}

coreModule.service('dashboardSrv', DashboardSrv);

//
// Code below is to export the service to react components
//

let singletonInstance: DashboardSrv;

export function setDashboardSrv(instance: DashboardSrv) {
  singletonInstance = instance;
}

export function getDashboardSrv(): DashboardSrv {
  return singletonInstance;
}
