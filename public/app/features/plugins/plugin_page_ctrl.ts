///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import {NavModel} from 'app/core/core';

var pluginInfoCache = {};

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  navModel: NavModel;

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
    this.page = _.find(app.includes, {slug: this.$routeParams.slug});

    pluginInfoCache[this.pluginId] = app;

    if (!this.page) {
      this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);

      this.navModel = {
        section: {
          title: "Page not found",
          url: app.defaultNavUrl,
          icon: 'icon-gf icon-gf-sadface',
        },
        menu: [],
      };

      return;
    }

    let menu = [];

    for (let item of app.includes) {
      if (item.addToNav) {
        if (item.type === 'dashboard') {
          menu.push({
            title: item.name,
            url: 'dashboard/db/' + item.slug,
            icon: 'fa fa-fw fa-dot-circle-o',
          });
        }
        if (item.type === 'page') {
          menu.push({
            title: item.name,
            url: `plugins/${app.id}/page/${item.slug}`,
            icon: 'fa fa-fw fa-dot-circle-o',
          });
        }
      }
    }

    this.navModel = {
      section: {
        title: app.name,
        url: app.defaultNavUrl,
        iconUrl: app.info.logos.small,
      },
      menu: menu,
    };
  }

  loadPluginInfo() {
    this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(app => {
      this.initPage(app);
    });
  }
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);

