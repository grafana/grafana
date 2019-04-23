import angular from 'angular';
import _ from 'lodash';

import config from 'app/core/config';
import coreModule from 'app/core/core_module';

import { AngularPanelPlugin, DataSourceApi } from '@grafana/ui/src/types';
import { importPanelPlugin, importDataSourcePlugin, importAppPlugin } from './plugin_loader';

/** @ngInject */
function pluginDirectiveLoader($compile, datasourceSrv, $rootScope, $q, $http, $templateCache, $timeout) {
  function getTemplate(component) {
    if (component.template) {
      return $q.when(component.template);
    }
    const cached = $templateCache.get(component.templateUrl);
    if (cached) {
      return $q.when(cached);
    }
    return $http.get(component.templateUrl).then(res => {
      return res.data;
    });
  }

  function relativeTemplateUrlToAbs(templateUrl, baseUrl) {
    if (!templateUrl) {
      return undefined;
    }
    if (templateUrl.indexOf('public') === 0) {
      return templateUrl;
    }
    return baseUrl + '/' + templateUrl;
  }

  function getPluginComponentDirective(options) {
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
        link: (scope, elem, attrs, ctrl) => {
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

  function loadPanelComponentInfo(scope, attrs) {
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
    return importPanelPlugin(panelInfo.module).then(panelPlugin => {
      const angularPanelPlugin = panelPlugin as AngularPanelPlugin;
      const PanelCtrl = angularPanelPlugin.components.PanelCtrl;
      componentInfo.Component = PanelCtrl;

      if (!PanelCtrl || PanelCtrl.registered) {
        return componentInfo;
      }

      if (PanelCtrl.templatePromise) {
        return PanelCtrl.templatePromise.then(res => {
          return componentInfo;
        });
      }

      if (panelInfo) {
        PanelCtrl.templateUrl = relativeTemplateUrlToAbs(PanelCtrl.templateUrl, panelInfo.baseUrl);
      }

      PanelCtrl.templatePromise = getTemplate(PanelCtrl).then(template => {
        PanelCtrl.templateUrl = null;
        PanelCtrl.template = `<grafana-panel ctrl="ctrl" class="panel-height-helper">${template}</grafana-panel>`;
        return componentInfo;
      });

      return PanelCtrl.templatePromise;
    });
  }

  function getModule(scope: any, attrs: any) {
    switch (attrs.type) {
      // QueryCtrl
      case 'query-ctrl': {
        const ds: DataSourceApi = scope.ctrl.datasource as DataSourceApi;

        return $q.when({
          baseUrl: ds.meta.baseUrl,
          name: 'query-ctrl-' + ds.meta.id,
          bindings: { target: '=', panelCtrl: '=', datasource: '=' },
          attrs: {
            target: 'ctrl.target',
            'panel-ctrl': 'ctrl',
            datasource: 'ctrl.datasource',
          },
          Component: ds.components.QueryCtrl,
        });
      }
      // Annotations
      case 'annotations-query-ctrl': {
        return importDataSourcePlugin(scope.ctrl.currentDatasource.meta.module).then(dsPlugin => {
          return {
            baseUrl: scope.ctrl.currentDatasource.meta.baseUrl,
            name: 'annotations-query-ctrl-' + scope.ctrl.currentDatasource.meta.id,
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
        return importDataSourcePlugin(dsMeta.module).then(dsPlugin => {
          scope.$watch(
            'ctrl.current',
            () => {
              scope.onModelChanged(scope.ctrl.current);
            },
            true
          );

          return {
            baseUrl: dsMeta.baseUrl,
            name: 'ds-config-' + dsMeta.id,
            bindings: { meta: '=', current: '=' },
            attrs: { meta: 'ctrl.datasourceMeta', current: 'ctrl.current' },
            Component: dsPlugin.components.ConfigCtrl,
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
            Component: appPlugin.angular.ConfigCtrl,
          };
        });
      }
      // App Page
      case 'app-page': {
        const appModel = scope.ctrl.appModel;
        return importAppPlugin(appModel).then(appPlugin => {
          return {
            baseUrl: appModel.baseUrl,
            name: 'app-page-' + appModel.id + '-' + scope.ctrl.page.slug,
            bindings: { appModel: '=' },
            attrs: { 'app-model': 'ctrl.appModel' },
            Component: appPlugin.angular.pages[scope.ctrl.page.component],
          };
        });
      }
      // Panel
      case 'panel': {
        return loadPanelComponentInfo(scope, attrs);
      }
      default: {
        return $q.reject({
          message: 'Could not find component type: ' + attrs.type,
        });
      }
    }
  }

  function appendAndCompile(scope, elem, componentInfo) {
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

  function registerPluginComponent(scope, elem, attrs, componentInfo) {
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
    link: (scope, elem, attrs) => {
      getModule(scope, attrs)
        .then(componentInfo => {
          registerPluginComponent(scope, elem, attrs, componentInfo);
        })
        .catch(err => {
          console.log('Plugin component error', err);
        });
    },
  };
}

coreModule.directive('pluginComponent', pluginDirectiveLoader);
