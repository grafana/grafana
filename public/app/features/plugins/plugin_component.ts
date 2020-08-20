import angular, { ILocationService } from 'angular';
import _ from 'lodash';

import config from 'app/core/config';
import coreModule from 'app/core/core_module';

import { DataSourceApi } from '@grafana/data';
import { importPanelPlugin, importDataSourcePlugin, importAppPlugin } from './plugin_loader';
import DatasourceSrv from './datasource_srv';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';

/** @ngInject */
function pluginDirectiveLoader(
  $compile: any,
  datasourceSrv: DatasourceSrv,
  $rootScope: GrafanaRootScope,
  $http: any,
  $templateCache: any,
  $timeout: any,
  $location: ILocationService
) {
  function getTemplate(component: { template: any; templateUrl: any }) {
    if (component.template) {
      return Promise.resolve(component.template);
    }
    const cached = $templateCache.get(component.templateUrl);
    if (cached) {
      return Promise.resolve(cached);
    }
    return $http.get(component.templateUrl).then((res: any) => {
      return res.data;
    });
  }

  function relativeTemplateUrlToAbs(templateUrl: string, baseUrl: string) {
    if (!templateUrl) {
      return undefined;
    }
    if (templateUrl.indexOf('public') === 0) {
      return templateUrl;
    }
    return baseUrl + '/' + templateUrl;
  }

  function getPluginComponentDirective(options: any) {
    // handle relative template urls for plugin templates
    options.Component.templateUrl = relativeTemplateUrlToAbs(options.Component.templateUrl, options.baseUrl);

    return () => {
      return {
        templateUrl: options.Component.templateUrl,
        template: options.Component.template,
        restrict: 'E',
        controller: options.Component,
        controllerAs: 'ctrl',
        bindToController: true,
        scope: options.bindings,
        link: (scope: any, elem: any, attrs: any, ctrl: any) => {
          if (ctrl.link) {
            ctrl.link(scope, elem, attrs, ctrl);
          }
          if (ctrl.init) {
            ctrl.init();
          }
        },
      };
    };
  }

  function loadPanelComponentInfo(scope: any, attrs: any) {
    const componentInfo: any = {
      name: 'panel-plugin-' + scope.panel.type,
      bindings: { dashboard: '=', panel: '=', row: '=' },
      attrs: {
        dashboard: 'dashboard',
        panel: 'panel',
        class: 'panel-height-helper',
      },
    };

    const panelInfo = config.panels[scope.panel.type];
    return importPanelPlugin(panelInfo.id).then(panelPlugin => {
      const PanelCtrl = panelPlugin.angularPanelCtrl;
      componentInfo.Component = PanelCtrl;

      if (!PanelCtrl || PanelCtrl.registered) {
        return componentInfo;
      }

      if (PanelCtrl.templatePromise) {
        return PanelCtrl.templatePromise.then((res: any) => {
          return componentInfo;
        });
      }

      if (panelInfo) {
        PanelCtrl.templateUrl = relativeTemplateUrlToAbs(PanelCtrl.templateUrl, panelInfo.baseUrl);
      }

      PanelCtrl.templatePromise = getTemplate(PanelCtrl).then((template: any) => {
        PanelCtrl.templateUrl = null;
        PanelCtrl.template = `<grafana-panel ctrl="ctrl" class="panel-height-helper">${template}</grafana-panel>`;
        return componentInfo;
      });

      return PanelCtrl.templatePromise;
    });
  }

  function getModule(scope: any, attrs: any): any {
    switch (attrs.type) {
      // QueryCtrl
      case 'query-ctrl': {
        const ds: DataSourceApi = scope.ctrl.datasource as DataSourceApi;

        return Promise.resolve({
          baseUrl: ds.meta.baseUrl,
          name: 'query-ctrl-' + ds.meta.id,
          bindings: { target: '=', panelCtrl: '=', datasource: '=' },
          attrs: {
            target: 'ctrl.target',
            'panel-ctrl': 'ctrl',
            datasource: 'ctrl.datasource',
          },
          Component: ds.components!.QueryCtrl,
        });
      }
      // Annotations
      case 'annotations-query-ctrl': {
        const baseUrl = scope.ctrl.currentDatasource.meta.baseUrl;
        const pluginId = scope.ctrl.currentDatasource.meta.id;

        return importDataSourcePlugin(scope.ctrl.currentDatasource.meta).then(dsPlugin => {
          return {
            baseUrl,
            name: 'annotations-query-ctrl-' + pluginId,
            bindings: { annotation: '=', datasource: '=' },
            attrs: {
              annotation: 'ctrl.currentAnnotation',
              datasource: 'ctrl.currentDatasource',
            },
            Component: dsPlugin.components.AnnotationsQueryCtrl,
          };
        });
      }
      // Datasource ConfigCtrl
      case 'datasource-config-ctrl': {
        const dsMeta = scope.ctrl.datasourceMeta;
        const angularUrl = $location.url();
        return importDataSourcePlugin(dsMeta).then(dsPlugin => {
          scope.$watch(
            'ctrl.current',
            () => {
              // This watcher can trigger when we navigate away due to late digests
              // This check is to stop onModelChanged from being called when navigating away
              // as it triggers a redux action which comes before the angular $routeChangeSucces and
              // This makes the bridgeSrv think location changed from redux before detecting it was actually
              // changed from angular.
              if (angularUrl === $location.url()) {
                scope.onModelChanged(scope.ctrl.current);
              }
            },
            true
          );

          return {
            baseUrl: dsMeta.baseUrl,
            name: 'ds-config-' + dsMeta.id,
            bindings: { meta: '=', current: '=' },
            attrs: { meta: 'ctrl.datasourceMeta', current: 'ctrl.current' },
            Component: dsPlugin.angularConfigCtrl,
          };
        });
      }
      // AppConfigCtrl
      case 'app-config-ctrl': {
        const model = scope.ctrl.model;
        return importAppPlugin(model).then(appPlugin => {
          return {
            baseUrl: model.baseUrl,
            name: 'app-config-' + model.id,
            bindings: { appModel: '=', appEditCtrl: '=' },
            attrs: { 'app-model': 'ctrl.model', 'app-edit-ctrl': 'ctrl' },
            Component: appPlugin.angularConfigCtrl,
          };
        });
      }
      // App Page
      case 'app-page': {
        const appModel = scope.ctrl.appModel;
        return importAppPlugin(appModel).then(appPlugin => {
          if (!appPlugin.angularPages) {
            throw new Error('Plugin has no page components');
          }

          return {
            baseUrl: appModel.baseUrl,
            name: 'app-page-' + appModel.id + '-' + scope.ctrl.page.slug,
            bindings: { appModel: '=' },
            attrs: { 'app-model': 'ctrl.appModel' },
            Component: appPlugin.angularPages[scope.ctrl.page.component],
          };
        });
      }
      // Panel
      case 'panel': {
        return loadPanelComponentInfo(scope, attrs);
      }
      default: {
        return Promise.reject({
          message: 'Could not find component type: ' + attrs.type,
        });
      }
    }
  }

  function appendAndCompile(scope: any, elem: JQuery, componentInfo: any) {
    const child = angular.element(document.createElement(componentInfo.name));
    _.each(componentInfo.attrs, (value, key) => {
      child.attr(key, value);
    });

    $compile(child)(scope);
    elem.empty();

    // let a binding digest cycle complete before adding to dom
    setTimeout(() => {
      scope.$applyAsync(() => {
        elem.append(child);
        setTimeout(() => {
          scope.$applyAsync(() => {
            scope.$broadcast('component-did-mount');
          });
        });
      });
    });
  }

  function registerPluginComponent(scope: any, elem: JQuery, attrs: any, componentInfo: any) {
    if (componentInfo.notFound) {
      elem.empty();
      return;
    }

    if (!componentInfo.Component) {
      throw {
        message: 'Failed to find exported plugin component for ' + componentInfo.name,
      };
    }

    if (!componentInfo.Component.registered) {
      const directiveName = attrs.$normalize(componentInfo.name);
      const directiveFn = getPluginComponentDirective(componentInfo);
      coreModule.directive(directiveName, directiveFn);
      componentInfo.Component.registered = true;
    }

    appendAndCompile(scope, elem, componentInfo);
  }

  return {
    restrict: 'E',
    link: (scope: any, elem: JQuery, attrs: any) => {
      getModule(scope, attrs)
        .then((componentInfo: any) => {
          registerPluginComponent(scope, elem, attrs, componentInfo);
        })
        .catch((err: any) => {
          console.error('Plugin component error', err);
        });
    },
  };
}

coreModule.directive('pluginComponent', pluginDirectiveLoader);
