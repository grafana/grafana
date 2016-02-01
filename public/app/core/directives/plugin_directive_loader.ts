///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import coreModule from '../core_module';

function pluginDirectiveLoader($compile, datasourceSrv) {

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
      case "metrics-query-editor":
        let datasource = scope.target.datasource || scope.ctrl.panel.datasource;
        return datasourceSrv.get(datasource).then(ds => {
          if (!scope.target.refId) {
            scope.target.refId = 'A';
          }

          return System.import(ds.meta.module).then(dsModule => {
            return {
              name: 'metrics-query-editor-' + ds.meta.id,
              bindings: {target: "=", panelCtrl: "="},
              attrs: {"target": "target", "panel-ctrl": "ctrl"},
              Component: dsModule.MetricsQueryEditor
            };
          });
        });
      case 'datasource-config-view':
        return System.import(scope.datasourceMeta.module).then(function(dsModule) {
          return {
            name: 'ds-config-' + scope.datasourceMeta.id,
            bindings: {meta: "=", current: "="},
            attrs: {meta: "datasourceMeta", current: "current"},
            Component: dsModule.ConfigView,
          };
        });
    }
  }

  function appendAndCompile(scope, elem, componentInfo) {
    console.log('compile', elem, componentInfo);
    var child = angular.element(document.createElement(componentInfo.name));
    _.each(componentInfo.attrs, (value, key) => {
      child.attr(key, value);
    });

    $compile(child)(scope);

    elem.empty();
    elem.append(child);
  }

  function registerPluginComponent(scope, elem, attrs, componentInfo) {
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
      });
    }
  };
}

coreModule.directive('pluginDirectiveLoader', pluginDirectiveLoader);
