import coreModule from 'app/core/core_module';
import { appEvents } from 'app/core/app_events';
import locationUtil from 'app/core/utils/location_util';
import { DashboardModel } from '../state/DashboardModel';
import { removePanel } from '../utils/panel';
import { DashboardMeta } from 'app/types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { ILocationService } from 'angular';

interface DashboardSaveOptions {
  folderId?: number;
  overwrite?: boolean;
  message?: string;
}

export class DashboardSrv {
  dashboard: DashboardModel;

  /** @ngInject */
  constructor(private backendSrv: BackendSrv, private $rootScope: any, private $location: ILocationService) {
    appEvents.on('save-dashboard', this.saveDashboard.bind(this), $rootScope);
    appEvents.on('panel-change-view', this.onPanelChangeView);
    appEvents.on('remove-panel', this.onRemovePanel);

    // Export to react
    setDashboardSrv(this);
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

  handleSaveDashboardError(
    clone: any,
    options: DashboardSaveOptions,
    err: { data: { status: string; message: any }; isHandled: boolean }
  ) {
    if (err.data && err.data.status === 'version-mismatch') {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Conflict',
        text: 'Someone else has updated this dashboard.',
        text2: 'Would you still like to save this dashboard?',
        yesText: 'Save & Overwrite',
        icon: 'fa-warning',
        onConfirm: () => {
          this.save(clone, options);
        },
      });
    }

    if (err.data && err.data.status === 'name-exists') {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Conflict',
        text: 'A dashboard with the same name in selected folder already exists.',
        text2: 'Would you still like to save this dashboard?',
        yesText: 'Save & Overwrite',
        icon: 'fa-warning',
        onConfirm: () => {
          this.save(clone, options);
        },
      });
    }

    if (err.data && err.data.status === 'plugin-dashboard') {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Plugin Dashboard',
        text: err.data.message,
        text2: 'Your changes will be lost when you update the plugin. Use Save As to create custom version.',
        yesText: 'Overwrite',
        icon: 'fa-warning',
        altActionText: 'Save As',
        onAltAction: () => {
          this.showSaveAsModal();
        },
        onConfirm: () => {
          this.save(clone, { ...options, overwrite: true });
        },
      });
    }
  }

  postSave(data: { version: number; url: string }) {
    this.dashboard.version = data.version;

    // important that these happen before location redirect below
    this.$rootScope.appEvent('dashboard-saved', this.dashboard);
    this.$rootScope.appEvent('alert-success', ['Dashboard saved']);

    const newUrl = locationUtil.stripBaseFromUrl(data.url);
    const currentPath = this.$location.path();

    if (newUrl !== currentPath) {
      this.$location.url(newUrl).replace();
    }

    return this.dashboard;
  }

  save(clone: any, { folderId, overwrite = false, message }: DashboardSaveOptions = {}) {
    folderId = folderId >= 0 ? folderId : this.dashboard.meta.folderId || clone.folderId;

    return this.backendSrv
      .saveDashboard(clone, { folderId, overwrite, message })
      .then((data: any) => this.postSave(data))
      .catch(this.handleSaveDashboardError.bind(this, clone, { folderId }));
  }

  saveDashboard(
    clone?: DashboardModel,
    {
      makeEditable = false,
      folderId,
      overwrite = false,
      message,
    }: DashboardSaveOptions & { makeEditable?: boolean } = {}
  ) {
    if (clone) {
      this.setCurrent(this.create(clone, this.dashboard.meta));
    }

    if (this.dashboard.meta.provisioned) {
      return this.showDashboardProvisionedModal();
    }

    if (!(this.dashboard.meta.canSave || makeEditable)) {
      return Promise.resolve();
    }

    if (this.dashboard.title === 'New dashboard') {
      return this.showSaveAsModal();
    }

    if (this.dashboard.version > 0) {
      return this.showSaveModal();
    }

    return this.save(this.dashboard.getSaveModelClone(), { folderId, overwrite, message });
  }

  saveJSONDashboard(json: string) {
    return this.save(JSON.parse(json), {});
  }

  showDashboardProvisionedModal() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<save-provisioned-dashboard-modal dismiss="dismiss()"></save-provisioned-dashboard-modal>',
    });
  }

  showSaveAsModal() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<save-dashboard-as-modal dismiss="dismiss()"></save-dashboard-as-modal>',
      modalClass: 'modal--narrow',
    });
  }

  showSaveModal() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: `<save-dashboard-modal dismiss="dismiss()"></save-dashboard-modal>`,
      modalClass: 'modal--narrow',
    });
  }

  starDashboard(dashboardId: string, isStarred: any) {
    let promise;

    if (isStarred) {
      promise = this.backendSrv.delete('/api/user/stars/dashboard/' + dashboardId).then(() => {
        return false;
      });
    } else {
      promise = this.backendSrv.post('/api/user/stars/dashboard/' + dashboardId).then(() => {
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
// Code below is to export the service to react components
//

let singletonInstance: DashboardSrv;

export function setDashboardSrv(instance: DashboardSrv) {
  singletonInstance = instance;
}

export function getDashboardSrv(): DashboardSrv {
  return singletonInstance;
}
