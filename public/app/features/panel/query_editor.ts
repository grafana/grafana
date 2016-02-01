///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

var directivesModule = angular.module('grafana.directives');

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
      case "metrics-query-editor": {
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
    if (!componentInfo.Component.registered) {
      var directiveName = attrs.$normalize(componentInfo.name);
      var directiveFn = getPluginComponentDirective(componentInfo);
      directivesModule.directive(directiveName, directiveFn);
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

/** @ngInject */
function metricsQueryEditor(dynamicDirectiveSrv, datasourceSrv) {
  return dynamicDirectiveSrv.create({
    watchPath: "ctrl.panel.datasource",
    directive: scope => {
      let datasource = scope.target.datasource || scope.ctrl.panel.datasource;
      return datasourceSrv.get(datasource).then(ds => {
        scope.ctrl.datasource = ds;

        if (!scope.target.refId) {
          scope.target.refId = 'A';
        }

        return System.import(ds.meta.module).then(dsModule => {
          return {
            name: 'metrics-query-editor-' + ds.meta.id,
            fn: dsModule.metricsQueryEditor,
          };
        });
      });
    }
  });
}

/** @ngInject */
function metricsQueryOptions(dynamicDirectiveSrv, datasourceSrv) {
  return dynamicDirectiveSrv.create({
    watchPath: "ctrl.panel.datasource",
    directive: scope => {
      return datasourceSrv.get(scope.ctrl.panel.datasource).then(ds => {
        return System.import(ds.meta.module).then(dsModule => {
          return {
            name: 'metrics-query-options-' + ds.meta.id,
            fn: dsModule.metricsQueryOptions
          };
        });
      });
    }
  });
}

directivesModule.directive('pluginDirectiveLoader', pluginDirectiveLoader);
directivesModule.directive('metricsQueryEditor', metricsQueryEditor);
directivesModule.directive('metricsQueryOptions', metricsQueryOptions);
