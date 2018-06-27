import angular from 'angular';
import _ from 'lodash';

import config from 'app/core/config';
import coreModule from 'app/core/core_module';
import { importPluginModule } from './plugin_loader';

import { UnknownPanelCtrl } from 'app/plugins/panel/unknown/module';

/** @ngInject **/
function pluginDirectiveLoader($compile, datasourceSrv, $rootScope, $q, $http, $templateCache) {
  function getTemplate(component) {
    if (component.template) {
      return $q.when(component.template);
    }
    var cached = $templateCache.get(component.templateUrl);
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

    return function() {
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
    var componentInfo: any = {
      name: 'panel-plugin-' + scope.panel.type,
      bindings: { dashboard: '=', panel: '=', row: '=' },
      attrs: {
        dashboard: 'dashboard',
        panel: 'panel',
        class: 'panel-height-helper',
      },
    };

    let panelInfo = config.panels[scope.panel.type];
    var panelCtrlPromise = Promise.resolve(UnknownPanelCtrl);
    if (panelInfo) {
      panelCtrlPromise = importPluginModule(panelInfo.module).then(function(panelModule) {
        return panelModule.PanelCtrl;
      });
    }

    return panelCtrlPromise.then(function(PanelCtrl: any) {
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

  function getModule(scope, attrs) {
    switch (attrs.type) {
      // QueryCtrl
      case 'query-ctrl': {
        let datasource = scope.target.datasource || scope.ctrl.panel.datasource;
        return datasourceSrv.get(datasource).then(ds => {
          scope.datasource = ds;

          return importPluginModule(ds.meta.module).then(dsModule => {
            return {
              baseUrl: ds.meta.baseUrl,
              name: 'query-ctrl-' + ds.meta.id,
              bindings: { target: '=', panelCtrl: '=', datasource: '=' },
              attrs: {
                target: 'target',
                'panel-ctrl': 'ctrl.panelCtrl',
                datasource: 'datasource',
              },
              Component: dsModule.QueryCtrl,
            };
          });
        });
      }
      // Annotations
      case 'annotations-query-ctrl': {
        return importPluginModule(scope.ctrl.currentDatasource.meta.module).then(function(dsModule) {
          return {
            baseUrl: scope.ctrl.currentDatasource.meta.baseUrl,
            name: 'annotations-query-ctrl-' + scope.ctrl.currentDatasource.meta.id,
            bindings: { annotation: '=', datasource: '=' },
            attrs: {
              annotation: 'ctrl.currentAnnotation',
              datasource: 'ctrl.currentDatasource',
            },
            Component: dsModule.AnnotationsQueryCtrl,
          };
        });
      }
      // Datasource ConfigCtrl
      case 'datasource-config-ctrl': {
        var dsMeta = scope.ctrl.datasourceMeta;
        return importPluginModule(dsMeta.module).then(function(dsModule): any {
          if (!dsModule.ConfigCtrl) {
            return { notFound: true };
          }

          return {
            baseUrl: dsMeta.baseUrl,
            name: 'ds-config-' + dsMeta.id,
            bindings: { meta: '=', current: '=' },
            attrs: { meta: 'ctrl.datasourceMeta', current: 'ctrl.current' },
            Component: dsModule.ConfigCtrl,
          };
        });
      }
      // AppConfigCtrl
      case 'app-config-ctrl': {
        let model = scope.ctrl.model;
        return importPluginModule(model.module).then(function(appModule) {
          return {
            baseUrl: model.baseUrl,
            name: 'app-config-' + model.id,
            bindings: { appModel: '=', appEditCtrl: '=' },
            attrs: { 'app-model': 'ctrl.model', 'app-edit-ctrl': 'ctrl' },
            Component: appModule.ConfigCtrl,
          };
        });
      }
      // App Page
      case 'app-page': {
        let appModel = scope.ctrl.appModel;
        return importPluginModule(appModel.module).then(function(appModule) {
          return {
            baseUrl: appModel.baseUrl,
            name: 'app-page-' + appModel.id + '-' + scope.ctrl.page.slug,
            bindings: { appModel: '=' },
            attrs: { 'app-model': 'ctrl.appModel' },
            Component: appModule[scope.ctrl.page.component],
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
    var child = angular.element(document.createElement(componentInfo.name));
    _.each(componentInfo.attrs, (value, key) => {
      child.attr(key, value);
    });

    $compile(child)(scope);
    elem.empty();

    // let a binding digest cycle complete before adding to dom
    setTimeout(function() {
      elem.append(child);
      scope.$applyAsync(function() {
        scope.$broadcast('component-did-mount');
        scope.$broadcast('refresh');
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
      var directiveName = attrs.$normalize(componentInfo.name);
      var directiveFn = getPluginComponentDirective(componentInfo);
      coreModule.directive(directiveName, directiveFn);
      componentInfo.Component.registered = true;
    }

    appendAndCompile(scope, elem, componentInfo);
  }

  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      getModule(scope, attrs)
        .then(function(componentInfo) {
          registerPluginComponent(scope, elem, attrs, componentInfo);
        })
        .catch(err => {
          $rootScope.appEvent('alert-error', ['Plugin Error', err.message || err]);
          console.log('Plugin component error', err);
        });
    },
  };
}

coreModule.directive('pluginComponent', pluginDirectiveLoader);
