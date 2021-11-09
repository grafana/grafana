import angular from 'angular';
import { find } from 'lodash';

import { getPluginSettings } from './PluginSettingsCache';
import { PluginMeta, AppEvents } from '@grafana/data';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { promiseToDigest } from '../../angular/promiseToDigest';
import { NavModelSrv } from 'app/angular/services/nav_model_srv';

export class AppPageCtrl {
  page: any;
  pluginId: any;
  appModel: any;
  navModel: any;

  /** @ngInject */
  constructor(private $routeParams: any, private $rootScope: GrafanaRootScope, private navModelSrv: NavModelSrv) {
    this.pluginId = $routeParams.pluginId;

    promiseToDigest($rootScope)(
      Promise.resolve(getPluginSettings(this.pluginId))
        .then((settings) => {
          this.initPage(settings);
        })
        .catch((err) => {
          this.$rootScope.appEvent(AppEvents.alertError, ['Unknown Plugin']);
          this.navModel = this.navModelSrv.getNotFoundNav();
        })
    );
  }

  initPage(app: PluginMeta) {
    this.appModel = app;
    this.page = find(app.includes, { slug: this.$routeParams.slug });

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
