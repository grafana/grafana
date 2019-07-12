import angular from 'angular';
import _ from 'lodash';

import { getPluginSettings } from './PluginSettingsCache';
import { PluginMeta } from '@grafana/ui';

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  navModel: any;

  /** @ngInject */
  constructor(private $routeParams: any, private $rootScope, private navModelSrv, private $q) {
    this.pluginId = $routeParams.pluginId;

    this.$q
      .when(getPluginSettings(this.pluginId))
      .then(settings => {
        this.initPage(settings);
      })
      .catch(err => {
        this.$rootScope.appEvent('alert-error', ['Unknown Plugin', '']);
        this.navModel = this.navModelSrv.getNotFoundNav();
      });
  }

  initPage(app: PluginMeta) {
    this.appModel = app;
    this.page = _.find(app.includes, { slug: this.$routeParams.slug });

    if (!this.page) {
      this.$rootScope.appEvent('alert-error', ['App Page Not Found', '']);
      this.navModel = this.navModelSrv.getNotFoundNav();
      return;
    }
    if (app.type !== 'app' || !app.enabled) {
      this.$rootScope.appEvent('alert-error', ['Application Not Enabled', '']);
      this.navModel = this.navModelSrv.getNotFoundNav();
      return;
    }

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
}

angular.module('grafana.controllers').controller('AppPageCtrl', AppPageCtrl);
