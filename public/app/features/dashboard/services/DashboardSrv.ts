import { AppEvents } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardMeta } from 'app/types';

import { RemovePanelEvent } from '../../../types/events';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';

export interface SaveDashboardOptions {
  /** The complete dashboard model. If `dashboard.id` is not set a new dashboard will be created. */
  dashboard: DashboardModel;
  /** Set a commit message for the version history. */
  message?: string;
  /** The UID of the folder to save the dashboard in. Overrides `folderId`. */
  folderUid?: string;
  /** Set to `true` if you want to overwrite an existing dashboard with a given dashboard UID. */
  overwrite?: boolean;
  /** Set the dashboard refresh interval.
   *  If this is lower than the minimum refresh interval, Grafana will ignore it and will enforce the minimum refresh interval. */
  refresh?: string;
}

export class DashboardSrv {
  dashboard?: DashboardModel;

  constructor() {
    appEvents.subscribe(RemovePanelEvent, (e) => this.onRemovePanel(e.payload));
  }

  create(dashboard: Dashboard, meta: DashboardMeta) {
    return new DashboardModel(dashboard, meta);
  }

  setCurrent(dashboard: DashboardModel | undefined) {
    this.dashboard = dashboard;
  }

  getCurrent(): DashboardModel | undefined {
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
    return getDashboardAPI().saveDashboard({
      dashboard: parsedJson,
      folderUid: this.dashboard?.meta.folderUid || parsedJson.folderUid,
    });
  }

  saveDashboard(
    data: SaveDashboardOptions,
    requestOptions?: Pick<BackendSrvRequest, 'showErrorAlert' | 'showSuccessAlert'>
  ) {
    return getDashboardAPI().saveDashboard({
      message: data.message,
      folderUid: data.folderUid,
      dashboard: data.dashboard.getSaveModelClone(),
      showErrorAlert: requestOptions?.showErrorAlert,
    });
  }

  starDashboard(dashboardUid: string, isStarred: boolean) {
    const backendSrv = getBackendSrv();

    const request = {
      showSuccessAlert: false,
      url: '/api/user/stars/dashboard/uid/' + dashboardUid,
      method: isStarred ? 'DELETE' : 'POST',
    };

    return backendSrv.request(request).then(() => {
      const newIsStarred = !isStarred;

      if (this.dashboard?.uid === dashboardUid) {
        this.dashboard.meta.isStarred = newIsStarred;
      }

      const message = newIsStarred
        ? t('notifications.starred-dashboard', 'Dashboard starred')
        : t('notifications.unstarred-dashboard', 'Dashboard unstarred');

      appEvents.emit(AppEvents.alertSuccess, [message]);

      return newIsStarred;
    });
  }
}

//
// Code below is to export the service to React components
//

let singletonInstance: DashboardSrv;

export function setDashboardSrv(instance: DashboardSrv) {
  singletonInstance = instance;
}

export function getDashboardSrv(): DashboardSrv {
  if (!singletonInstance) {
    singletonInstance = new DashboardSrv();
  }
  return singletonInstance;
}
