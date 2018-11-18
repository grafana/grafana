import coreModule from 'app/core/core_module';
import { DashboardModel } from './dashboard_model';
import locationUtil from 'app/core/utils/location_util';

export class DashboardSrv {
  dash: any;

  /** @ngInject */
  constructor(private backendSrv, private $rootScope, private $location) {}

  create(dashboard, meta) {
    return new DashboardModel(dashboard, meta);
  }

  setCurrent(dashboard) {
    this.dash = dashboard;
  }

  getCurrent() {
    return this.dash;
  }

  handleSaveDashboardError(clone, options, err) {
    options = options || {};
    options.overwrite = true;

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
          this.save(clone, { overwrite: true });
        },
      });
    }
  }

  postSave(clone, data) {
    this.dash.version = data.version;

    // important that these happens before location redirect below
    this.$rootScope.appEvent('dashboard-saved', this.dash);
    this.$rootScope.appEvent('alert-success', ['Dashboard saved']);

    const newUrl = locationUtil.stripBaseFromUrl(data.url);
    const currentPath = this.$location.path();

    if (newUrl !== currentPath) {
      this.$location.url(newUrl).replace();
    }

    return this.dash;
  }

  save(clone, options) {
    options = options || {};
    options.folderId = options.folderId >= 0 ? options.folderId : this.dash.meta.folderId || clone.folderId;

    return this.backendSrv
      .saveDashboard(clone, options)
      .then(this.postSave.bind(this, clone))
      .catch(this.handleSaveDashboardError.bind(this, clone, options));
  }

  saveDashboard(options?, clone?) {
    if (clone) {
      this.setCurrent(this.create(clone, this.dash.meta));
    }

    if (this.dash.meta.provisioned) {
      return this.showDashboardProvisionedModal();
    }

    if (!this.dash.meta.canSave && options.makeEditable !== true) {
      return Promise.resolve();
    }

    if (this.dash.title === 'New dashboard') {
      return this.showSaveAsModal();
    }

    if (this.dash.version > 0) {
      return this.showSaveModal();
    }

    return this.save(this.dash.getSaveModelClone(), options);
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
      templateHtml: '<save-dashboard-modal dismiss="dismiss()"></save-dashboard-modal>',
      modalClass: 'modal--narrow',
    });
  }

  starDashboard(dashboardId, isStarred) {
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

    return promise.then(res => {
      if (this.dash && this.dash.id === dashboardId) {
        this.dash.meta.isStarred = res;
      }
      return res;
    });
  }
}

coreModule.service('dashboardSrv', DashboardSrv);
