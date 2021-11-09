import coreModule from 'app/angular/core_module';
import { appEvents } from 'app/core/app_events';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';
import { DashboardMeta } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { saveDashboard } from 'app/features/manage-dashboards/state/actions';
import { RemovePanelEvent } from '../../../types/events';

export class DashboardSrv {
  dashboard?: DashboardModel;

  constructor() {
    appEvents.subscribe(RemovePanelEvent, (e) => this.onRemovePanel(e.payload));
  }

  create(dashboard: any, meta: DashboardMeta) {
    return new DashboardModel(dashboard, meta);
  }

  setCurrent(dashboard: DashboardModel) {
    this.dashboard = dashboard;
  }

  getCurrent(): DashboardModel | undefined {
    if (!this.dashboard) {
      console.warn('Calling getDashboardSrv().getCurrent() without calling getDashboardSrv().setCurrent() first.');
    }
    return this.dashboard;
  }

  onRemovePanel = (panelId: number) => {
    const dashboard = this.getCurrent();
    if (dashboard) {
      removePanel(dashboard, dashboard.getPanelById(panelId)!, true);
    }
  };

  saveJSONDashboard(json: string) {
    const parsedJson = JSON.parse(json);
    return saveDashboard({
      dashboard: parsedJson,
      folderId: this.dashboard?.meta.folderId || parsedJson.folderId,
    });
  }

  starDashboard(dashboardId: string, isStarred: any) {
    const backendSrv = getBackendSrv();
    let promise;

    if (isStarred) {
      promise = backendSrv.delete('/api/user/stars/dashboard/' + dashboardId).then(() => {
        return false;
      });
    } else {
      promise = backendSrv.post('/api/user/stars/dashboard/' + dashboardId).then(() => {
        return true;
      });
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
// Code below is to export the service to React components
//

let singletonInstance: DashboardSrv;

export function setDashboardSrv(instance: DashboardSrv) {
  singletonInstance = instance;
}

export function getDashboardSrv(): DashboardSrv {
  return singletonInstance;
}
