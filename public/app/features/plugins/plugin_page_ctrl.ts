import angular from 'angular';
import _ from 'lodash';
import { PluginEditCtrl } from './plugin_edit_ctrl';

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
    this.page = _.find(app.includes, { slug: this.$routeParams.slug });

    pluginInfoCache[this.pluginId] = app;

    if (!this.page) {
      this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);

      this.navModel = this.navModelSrv.getNotFoundNav();
      return;
    }

    this.navModel = PluginEditCtrl.getPluginNavModel(app, this.$routeParams.slug);

    // If anythign is active then the navigation was handled using tabs
    for (let i = 0; i < this.navModel.main.children.length; i++) {
      if (this.navModel.main.children[i].active) {
        return;
      }
    }

    // Don't show tabs
    const pluginNav = this.navModelSrv.getNav('plugin-page-' + app.id);

    this.navModel = {
      main: {
        img: app.info.logos.large,
        subTitle: app.name,
        url: '',
        text: this.page.name,
        breadcrumbs: [{ title: app.name, url: pluginNav.main.url }],
      },
    };
  }

  loadPluginInfo() {
    this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(app => {
      this.initPage(app);
    });
  }
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);
