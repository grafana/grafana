///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var pluginInfoCache = {};

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  appLogoUrl: any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams: any, private $rootScope) {
    this.pluginId = $routeParams.pluginId;

    if (pluginInfoCache[this.pluginId]) {
      this.initPage(pluginInfoCache[this.pluginId]);
    } else {
      this.loadPluginInfo();
    }
  }

  initPage(app) {
    this.appModel = app;
    this.page = _.findWhere(app.includes, {slug: this.$routeParams.slug});
    this.appLogoUrl = app.info.logos.small;

    pluginInfoCache[this.pluginId] = app;

    if (!this.page) {
      this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);
    }
  }

  loadPluginInfo() {
    this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(app => {
      this.initPage(app);
    });
  }
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);

