import angular, { IQService } from 'angular';
import _ from 'lodash';

import { getPluginSettings } from './PluginSettingsCache';
import { PluginMeta } from '@grafana/data';
import { NavModelSrv } from 'app/core/core';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { AppEvents } from '@grafana/data';

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  navModel: any;

  /** @ngInject */
  constructor(
    private $routeParams: any,
    private $rootScope: GrafanaRootScope,
    private navModelSrv: NavModelSrv,
    private $q: IQService
  ) {
    this.pluginId = $routeParams.pluginId;

    this.$q
      .when(getPluginSettings(this.pluginId))
      .then(settings => {
        this.initPage(settings);
      })
      .catch(err => {
        this.$rootScope.appEvent(AppEvents.alertError, ['Unknown Plugin']);
        this.navModel = this.navModelSrv.getNotFoundNav();
      });
  }

  initPage(app: PluginMeta) {
    this.appModel = app;
    this.page = _.find(app.includes, { slug: this.$routeParams.slug });

    if (!this.page) {
      this.$rootScope.appEvent(AppEvents.alertError, ['App Page Not Found']);
      this.navModel = this.navModelSrv.getNotFoundNav();
      return;
    }
    if (app.type !== 'app' || !app.enabled) {
      this.$rootScope.appEvent(AppEvents.alertError, ['Application Not Enabled']);
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
