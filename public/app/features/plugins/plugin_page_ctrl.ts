///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var pluginInfoCache = {};

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams: any, private $rootScope, private navModelSrv) {
    this.pluginId = $routeParams.pluginId;

    if (pluginInfoCache[this.pluginId]) {
      this.initPage(pluginInfoCache[this.pluginId]);
    } else {
      this.loadPluginInfo();
    }
  }

  initPage(app) {
    this.appModel = app;
    this.page = _.find(app.includes, {slug: this.$routeParams.slug});

    pluginInfoCache[this.pluginId] = app;

    if (!this.page) {
      this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);

      this.navModel = this.navModelSrv.getNotFoundNav();
      return;
    }

    this.navModel = this.navModelSrv.getNav('plugin-page-' + app.id);
    this.navModel.breadcrumbs.push({text: this.page.name});
  }

  loadPluginInfo() {
    this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(app => {
      this.initPage(app);
    });
  }
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);

