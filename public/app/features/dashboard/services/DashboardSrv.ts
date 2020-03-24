import { ILocationService } from 'angular';
import { PanelEvents } from '@grafana/data';

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
  constructor(private $rootScope: GrafanaRootScope, private $location: ILocationService) {
    appEvents.on(PanelEvents.panelChangeView, this.onPanelChangeView);
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

  onPanelChangeView = ({
    fullscreen = false,
    edit = false,
    panelId,
  }: {
    fullscreen?: boolean;
    edit?: boolean;
    panelId?: number;
  }) => {
    const urlParams = this.$location.search();

    // handle toggle logic
    // I hate using these truthy converters (!!) but in this case
    // I think it's appropriate. edit can be null/false/undefined and
    // here i want all of those to compare the same
    if (fullscreen === urlParams.fullscreen && edit === !!urlParams.edit) {
      const paramsToRemove = ['fullscreen', 'edit', 'panelId', 'tab'];
      for (const key of paramsToRemove) {
        delete urlParams[key];
      }

      this.$location.search(urlParams);
      return;
    }

    const newUrlParams = {
      ...urlParams,
      fullscreen: fullscreen || undefined,
      edit: edit || undefined,
      tab: edit ? urlParams.tab : undefined,
      panelId,
    };

    Object.keys(newUrlParams).forEach(key => {
      if (newUrlParams[key] === undefined) {
        delete newUrlParams[key];
      }
    });

    this.$location.search(newUrlParams);
  };

  saveJSONDashboard(json: string) {
    return getBackendSrv().saveDashboard(JSON.parse(json), {});
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
