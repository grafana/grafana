import angular from 'angular';
import _ from 'lodash';
import Remarkable from 'remarkable';
import { getPluginSettings } from './PluginSettingsCache';

export class PluginEditCtrl {
  model: any;
  pluginIcon: string;
  pluginId: any;
  includes: any;
  readmeHtml: any;
  includedDatasources: any;
  tab: string;
  navModel: any;
  hasDashboards: any;
  preUpdateHook: () => any;
  postUpdateHook: () => any;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private backendSrv, private $sce, private $routeParams, navModelSrv) {
    this.pluginId = $routeParams.pluginId;
    this.preUpdateHook = () => Promise.resolve();
    this.postUpdateHook = () => Promise.resolve();

    this.init();
  }

  setNavModel(model) {
    let defaultTab = 'readme';

    this.navModel = {
      main: {
        img: model.info.logos.large,
        subTitle: model.info.author.name,
        url: '',
        text: model.name,
        breadcrumbs: [{ title: 'Plugins', url: 'plugins' }],
        children: [
          {
            icon: 'fa fa-fw fa-file-text-o',
            id: 'readme',
            text: 'Readme',
            url: `plugins/${this.model.id}/edit?tab=readme`,
          },
        ],
      },
    };

    if (model.type === 'app') {
      this.navModel.main.children.push({
        icon: 'gicon gicon-cog',
        id: 'config',
        text: 'Config',
        url: `plugins/${this.model.id}/edit?tab=config`,
      });

      const hasDashboards: any = _.find(model.includes, { type: 'dashboard' });

      if (hasDashboards) {
        this.navModel.main.children.push({
          icon: 'gicon gicon-dashboard',
          id: 'dashboards',
          text: 'Dashboards',
          url: `plugins/${this.model.id}/edit?tab=dashboards`,
        });
      }

      defaultTab = 'config';
    }

    this.tab = this.$routeParams.tab || defaultTab;

    for (const tab of this.navModel.main.children) {
      if (tab.id === this.tab) {
        tab.active = true;
      }
    }
  }

  init() {
    return getPluginSettings(this.pluginId).then(result => {
      this.model = result;
      this.pluginIcon = this.getPluginIcon(this.model.type);

      this.model.dependencies.plugins.forEach(plug => {
        plug.icon = this.getPluginIcon(plug.type);
      });

      this.includes = _.map(result.includes, plug => {
        plug.icon = this.getPluginIcon(plug.type);
        return plug;
      });

      this.setNavModel(this.model);
      return this.initReadme();
    });
  }

  initReadme() {
    return this.backendSrv.get(`/api/plugins/${this.pluginId}/markdown/readme`).then(res => {
      const md = new Remarkable({
        linkify: true,
      });
      this.readmeHtml = this.$sce.trustAsHtml(md.render(res));
    });
  }

  getPluginIcon(type) {
    switch (type) {
      case 'datasource':
        return 'gicon gicon-datasources';
      case 'panel':
        return 'icon-gf icon-gf-panel';
      case 'app':
        return 'icon-gf icon-gf-apps';
      case 'page':
        return 'icon-gf icon-gf-endpoint-tiny';
      case 'dashboard':
        return 'gicon gicon-dashboard';
      default:
        return 'icon-gf icon-gf-apps';
    }
  }

  update() {
    this.preUpdateHook()
      .then(() => {
        const updateCmd = _.extend(
          {
            enabled: this.model.enabled,
            pinned: this.model.pinned,
            jsonData: this.model.jsonData,
            secureJsonData: this.model.secureJsonData,
          },
          {}
        );
        return this.backendSrv.post(`/api/plugins/${this.pluginId}/settings`, updateCmd);
      })
      .then(this.postUpdateHook)
      .then(res => {
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
    const modalScope = this.$scope.$new(true);
    modalScope.plugin = this.model;

    this.$rootScope.appEvent('show-modal', {
      src: 'public/app/features/plugins/partials/update_instructions.html',
      scope: modalScope,
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
