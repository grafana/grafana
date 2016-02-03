///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import coreModule from '../core_module';

function pluginDirectiveLoader($compile, datasourceSrv, $rootScope, $q) {

  function getPluginComponentDirective(options) {
    return function() {
      return {
        templateUrl: options.Component.templateUrl,
        restrict: 'E',
        controller: options.Component,
        controllerAs: 'ctrl',
        bindToController: true,
        scope: options.bindings,
        link: (scope, elem, attrs, ctrl) => {
          if (ctrl.link) {
            ctrl.link(scope, elem, attrs, ctrl);
          }
        }
      };
    };
  }

  function getModule(scope, attrs) {
    switch (attrs.type) {
      // QueryCtrl
      case "query-ctrl": {
        let datasource = scope.target.datasource || scope.ctrl.panel.datasource;
        return datasourceSrv.get(datasource).then(ds => {
          scope.datasource = ds;

          return System.import(ds.meta.module).then(dsModule => {
            return {
              name: 'query-ctrl-' + ds.meta.id,
              bindings: {target: "=", panelCtrl: "=", datasource: "="},
              attrs: {"target": "target", "panel-ctrl": "ctrl", datasource: "datasource"},
              Component: dsModule.QueryCtrl
            };
          });
        });
      }
      // QueryOptionsCtrl
      case "query-options-ctrl": {
        return datasourceSrv.get(scope.ctrl.panel.datasource).then(ds => {
          return System.import(ds.meta.module).then((dsModule): any => {
            if (!dsModule.QueryOptionsCtrl) {
              return {notFound: true};
            }

            return {
              name: 'query-options-ctrl-' + ds.meta.id,
              bindings: {panelCtrl: "="},
              attrs: {"panel-ctrl": "ctrl"},
              Component: dsModule.QueryOptionsCtrl
            };
          });
        });
      }
      // Annotations
      case "annotations-query-ctrl": {
        return System.import(scope.currentDatasource.meta.module).then(function(dsModule) {
          return {
            name: 'annotations-query-ctrl-' + scope.currentDatasource.meta.id,
            bindings: {annotation: "=", datasource: "="},
            attrs: {"annotation": "currentAnnotation", datasource: "currentDatasource"},
            Component: dsModule.AnnotationsQueryCtrl,
          };
        });
      }
      // ConfigCtrl
      case 'datasource-config-ctrl': {
        return System.import(scope.datasourceMeta.module).then(function(dsModule) {
          return {
            name: 'ds-config-' + scope.datasourceMeta.id,
            bindings: {meta: "=", current: "="},
            attrs: {meta: "datasourceMeta", current: "current"},
            Component: dsModule.ConfigCtrl,
          };
        });
      }
      default: {
        return $q.reject({message: "Could not find component type: " + attrs.type });
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
    elem.append(child);
  }

  function registerPluginComponent(scope, elem, attrs, componentInfo) {
    if (componentInfo.notFound) {
      elem.empty();
      return;
    }

    if (!componentInfo.Component) {
      throw {message: 'Failed to find exported plugin component for ' + componentInfo.name};
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
      getModule(scope, attrs).then(function (componentInfo) {
        registerPluginComponent(scope, elem, attrs, componentInfo);
      }).catch(err => {
        $rootScope.appEvent('alert-error', ['Plugin Error', err.message || err]);
      });
    }
  };
}

coreModule.directive('pluginComponent', pluginDirectiveLoader);
