///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import coreModule from 'app/core/core_module';
import {DashboardModel} from './model';

export class DashboardSrv {
  dash: any;

  /** @ngInject */
  constructor(private backendSrv, private $rootScope, private $location) {
  }

  create(dashboard, meta) {
    return new DashboardModel(dashboard, meta);
  }

  setCurrent(dashboard) {
    this.dash = dashboard;
  }

  getCurrent() {
    return this.dash;
  }

  handleSaveDashboardError(clone, err) {
    if (err.data && err.data.status === "version-mismatch") {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Conflict',
        text: 'Someone else has updated this dashboard.',
        text2: 'Would you still like to save this dashboard?',
        yesText: "Save & Overwrite",
        icon: "fa-warning",
        onConfirm: () => {
          this.save(clone, {overwrite: true});
        }
      });
    }

    if (err.data && err.data.status === "name-exists") {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Conflict',
        text: 'Dashboard with the same name exists.',
        text2: 'Would you still like to save this dashboard?',
        yesText: "Save & Overwrite",
        icon: "fa-warning",
        onConfirm: () => {
          this.save(clone, {overwrite: true});
        }
      });
    }

    if (err.data && err.data.status === "plugin-dashboard") {
      err.isHandled = true;

      this.$rootScope.appEvent('confirm-modal', {
        title: 'Plugin Dashboard',
        text: err.data.message,
        text2: 'Your changes will be lost when you update the plugin. Use Save As to create custom version.',
        yesText: "Overwrite",
        icon: "fa-warning",
        altActionText: "Save As",
        onAltAction: () => {
          this.showSaveAsModal();
        },
        onConfirm: () => {
          this.save(clone, {overwrite: true});
        }
      });
    }
  }

  postSave(clone, data) {
    this.dash.version = data.version;

    var dashboardUrl = '/dashboard/db/' + data.slug;
    if (dashboardUrl !== this.$location.path()) {
      this.$location.url(dashboardUrl);
    }

    this.$rootScope.appEvent('dashboard-saved', this.dash);
    this.$rootScope.appEvent('alert-success', ['Dashboard saved']);
  }

  save(clone, options) {
    return this.backendSrv.saveDashboard(clone, options)
      .then(this.postSave.bind(this, clone))
      .catch(this.handleSaveDashboardError.bind(this, clone));
  }

  saveDashboard(options, clone) {
    if (clone) {
      this.setCurrent(this.create(clone, this.dash.meta));
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

  showSaveAsModal() {
    var newScope = this.$rootScope.$new();
    newScope.clone = this.dash.getSaveModelClone();
    newScope.clone.editable = true;
    newScope.clone.hideControls = false;

    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<save-dashboard-as-modal dismiss="dismiss()"></save-dashboard-as-modal>',
      scope: newScope,
      modalClass: 'modal--narrow'
    });
  }

  showSaveModal() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<save-dashboard-modal dismiss="dismiss()"></save-dashboard-modal>',
      scope: this.$rootScope.$new(),
      modalClass: 'modal--narrow'
    });
  }
}

coreModule.service('dashboardSrv', DashboardSrv);

