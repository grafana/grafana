///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class PluginEditCtrl {
  model: any;
  pluginIcon: string;
  pluginId: any;
  includes: any;
  readmeHtml: any;
  includedDatasources: any;
  tabIndex: number;
  tabs: any;
  hasDashboards: any;
  preUpdateHook: () => any;
  postUpdateHook: () => any;

  /** @ngInject */
  constructor(private backendSrv, private $routeParams, private $sce, private $http) {
    this.model = {};
    this.pluginId = $routeParams.pluginId;
    this.tabIndex = 0;
    this.tabs = ['Overview'];
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
        this.tabs.push('Config');

        this.hasDashboards = _.findWhere(result.includes, {type: 'dashboard'});
        if (this.hasDashboards) {
          this.tabs.push('Dashboards');
        }
      }

      return this.initReadme();
    });
  }

  initReadme() {
    return this.backendSrv.get(`/api/plugins/${this.pluginId}/readme`).then(res => {
      return System.import('remarkable').then(Remarkable => {
        var md = new Remarkable();
        this.readmeHtml = this.$sce.trustAsHtml(md.render(res));
      });
    });
  }

  getPluginIcon(type) {
    switch (type) {
      case 'datasource':  return 'icon-gf icon-gf-datasources';
      case 'panel':  return 'icon-gf icon-gf-panel';
      case 'app':  return 'icon-gf icon-gf-apps';
      case 'page':  return 'icon-gf icon-gf-share';
      case 'dashboard':  return 'icon-gf icon-gf-dashboard';
    }
  }

  update() {
    var chain = Promise.resolve();
    var self = this;
    // if set, handle the preUpdateHook. If this returns a promise,
    // the next step of execution will block until the promise resolves.
    // if the promise is rejected, this update will be aborted.
    if (this.preUpdateHook != null) {
      chain = self.preUpdateHook();
    }

    // Perform the core update procedure
    chain = chain.then(function() {
      var updateCmd = _.extend({
        enabled: self.model.enabled,
        pinned: self.model.pinned,
        jsonData: self.model.jsonData,
        secureJsonData: self.model.secureJsonData,
      }, {});

      return self.backendSrv.post(`/api/plugins/${self.pluginId}/settings`, updateCmd);
    });

    // if set, performt he postUpdate hook. If a promise is returned it will block
    // the final step of the update procedure (reloading the page) until the promise
    // resolves.  If the promise is rejected the page will not be reloaded.
    if (this.postUpdateHook != null) {
      chain = chain.then(function() {
        return this.postUpdateHook();
      });
    }

    // all stesp in the update procedure are complete, so reload the page to make changes
    // take effect.
    chain.then(function() {
      window.location.href = window.location.href;
    });
  }

  setPreUpdateHook(callback: () => any) {
    this.preUpdateHook = callback;
  }

  setPostUpdateHook(callback: () => any) {
    this.postUpdateHook = callback;
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

