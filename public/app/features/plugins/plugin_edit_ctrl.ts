import angular from 'angular';
import _ from 'lodash';
import Remarkable from 'remarkable';

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

  static getPluginNavModel(model: any, activeSlug?: string) {
    let navModel = {
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
            url: `plugins/${model.id}/edit?tab=readme`,
            active: false,
          },
        ],
      },
    };

    const tabs = _.filter(model.includes, { type: 'page', showAsTab: true });
    if (tabs) {
      _.forEach(tabs, t => {
        navModel.main.children.push({
          icon: t.icon,
          id: t.slug,
          text: t.name,
          active: t.slug === activeSlug,
          url: `plugins/${model.id}/page/${t.slug}`,
        });
      });
    }

    if (model.type === 'app') {
      navModel.main.children.push({
        icon: 'gicon gicon-cog',
        id: 'config',
        text: 'Config',
        url: `plugins/${model.id}/edit?tab=config`,
        active: false,
      });

      let hasDashboards = _.find(model.includes, { type: 'dashboard' });

      if (hasDashboards) {
        navModel.main.children.push({
          icon: 'gicon gicon-dashboard',
          id: 'dashboards',
          text: 'Dashboards',
          url: `plugins/${model.id}/edit?tab=dashboards`,
          active: false,
        });
      }
    }

    return navModel;
  }

  setNavModel(model) {
    let defaultTab = 'readme';
    this.navModel = PluginEditCtrl.getPluginNavModel(model);
    if (model.type === 'app') {
      defaultTab = 'config';
    }

    this.tab = this.$routeParams.tab || defaultTab;

    for (let tab of this.navModel.main.children) {
      if (tab.id === this.tab) {
        tab.active = true;
      }
    }
  }

  init() {
    return this.backendSrv.get(`/api/plugins/${this.pluginId}/settings`).then(result => {
      this.model = result;
      this.pluginIcon = this.getPluginIcon(this.model.type);

      this.model.dependencies.plugins.forEach(plug => {
        plug.icon = this.getPluginIcon(plug.type);
      });

      this.includes = _.map(result.includes, plug => {
        if (!plug.icon) {
          plug.icon = this.getPluginIcon(plug.type);
        }
        return plug;
      });

      this.setNavModel(this.model);
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
      case 'datasource':
        return 'icon-gf icon-gf-datasources';
      case 'panel':
        return 'icon-gf icon-gf-panel';
      case 'app':
        return 'icon-gf icon-gf-apps';
      case 'page':
        return 'icon-gf icon-gf-endpoint-tiny';
      case 'dashboard':
        return 'icon-gf icon-gf-dashboard';
      default:
        return 'icon-gf icon-gf-apps';
    }
  }

  update() {
    this.preUpdateHook()
      .then(() => {
        var updateCmd = _.extend(
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
    var modalScope = this.$scope.$new(true);
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
