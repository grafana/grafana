///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import appEvents from 'app/core/app_events';
import Remarkable from 'remarkable';

export class PluginEditCtrl {
  model: any;
  pluginIcon: string;
  pluginId: any;
  includes: any;
  readmeHtml: any;
  includedDatasources: any;
  tabIndex: number;
  tabs: any;
  navModel: any;
  hasDashboards: any;
  preUpdateHook: () => any;
  postUpdateHook: () => any;

  /** @ngInject */
  constructor(
    private $scope,
    private $rootScope,
    private backendSrv,
    private $routeParams,
    private $sce,
    private $http,
    private navModelSrv,
  ) {
    this.navModel = navModelSrv.getPluginsNav();
    this.model = {};
    this.pluginId = $routeParams.pluginId;
    this.tabIndex = 0;
    this.tabs = ['Readme'];

    this.preUpdateHook = () => Promise.resolve();
    this.postUpdateHook = () => Promise.resolve();
  }

  init() {
    return this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(result => {
      this.model = result;
      this.pluginIcon = this.getPluginIcon(this.model.type);

      this.model.dependencies.plugins.forEach(plug => {
        plug.icon = this.getPluginIcon(plug.type);
      });

      this.includes = _.map(result.includes, plug => {
        plug.icon = this.getPluginIcon(plug.type);
        return plug;
      });

      if (this.model.type === 'app') {
        this.hasDashboards = _.find(result.includes, {type: 'dashboard'});
        if (this.hasDashboards) {
          this.tabs.unshift('Dashboards');
        }

        this.tabs.unshift('Config');
        this.tabIndex = 0;
      }

      return this.initReadme();
    });
  }

  initReadme() {
    return this.backendSrv.get(`/api/plugins/${this.pluginId}/markdown/readme`).then(res => {
      var md = new Remarkable();
      this.readmeHtml = this.$sce.trustAsHtml(md.render(res));
    });
  }

  getPluginIcon(type) {
    switch (type) {
      case 'datasource':  return 'icon-gf icon-gf-datasources';
      case 'panel':  return 'icon-gf icon-gf-panel';
      case 'app':  return 'icon-gf icon-gf-apps';
      case 'page':  return 'icon-gf icon-gf-endpoint-tiny';
      case 'dashboard':  return 'icon-gf icon-gf-dashboard';
    }
  }

  update() {
    this.preUpdateHook().then(() => {
      var updateCmd = _.extend({
        enabled: this.model.enabled,
        pinned: this.model.pinned,
        jsonData: this.model.jsonData,
        secureJsonData: this.model.secureJsonData,
      }, {});
      return this.backendSrv.post(`/api/plugins/${this.pluginId}/settings`, updateCmd);
    })
    .then(this.postUpdateHook)
    .then((res) => {
      window.location.href = window.location.href;
    });
  }

  importDashboards() {
    return Promise.resolve();
  }

  setPreUpdateHook(callback: () => any) {
    this.preUpdateHook = callback;
  }

  setPostUpdateHook(callback: () => any) {
    this.postUpdateHook = callback;
  }

  updateAvailable() {
    var modalScope = this.$scope.$new(true);
    modalScope.plugin = this.model;

    this.$rootScope.appEvent('show-modal', {
      src: 'public/app/features/plugins/partials/update_instructions.html',
      scope: modalScope
    });
  }

  enable() {
    this.model.enabled = true;
    this.model.pinned = true;
    this.update();
  }

  disable() {
    this.model.enabled = false;
    this.model.pinned = false;
    this.update();
  }
}

angular.module('grafana.controllers').controller('PluginEditCtrl', PluginEditCtrl);
