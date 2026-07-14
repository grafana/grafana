import { t } from '@grafana/i18n';
import { type BackendSrvRequest } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardMeta } from 'app/types/dashboard';

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

  async saveJSONDashboard(json: string) {
    const parsedJson = JSON.parse(json);
    return (await getDashboardAPI()).saveDashboard({
      dashboard: parsedJson,
      folderUid: this.dashboard?.meta.folderUid || parsedJson.folderUid,
      message: t('dashboard.dashboard-srv.message.edit-dashboard-json', 'Edit Dashboard JSON'),
      k8s: this.dashboard?.meta.k8s,
    });
  }

  async saveDashboard(
    data: SaveDashboardOptions,
    requestOptions?: Pick<BackendSrvRequest, 'showErrorAlert' | 'showSuccessAlert'>
  ) {
    return (await getDashboardAPI()).saveDashboard({
      message: data.message,
      folderUid: data.folderUid,
      dashboard: data.dashboard.getSaveModelClone(),
      showErrorAlert: requestOptions?.showErrorAlert,
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
