///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams: any, private $rootScope) {
    this.pluginId = $routeParams.pluginId;
    this.backendSrv.get(`/api/org/plugins/${this.pluginId}/settings`).then(app => {
      this.appModel = app;
      this.page = _.findWhere(app.pages, {slug: this.$routeParams.slug});
      if (!this.page) {
        $rootScope.appEvent('alert-error', ['App Page Not Found', '']);
      }
    });
  }
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);

