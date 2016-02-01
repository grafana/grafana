///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

import {UnknownPanel} from '../../plugins/panel/unknown/module';

var directiveModule = angular.module('grafana.directives');

/** @ngInject */
function panelLoader($compile, dynamicDirectiveSrv, $http, $q, $injector, $templateCache) {
  return {
    restrict: 'E',
    scope: {
      dashboard: "=",
      row: "=",
      panel: "="
    },
    link: function(scope, elem, attrs) {

      function getTemplate(directive) {
        if (directive.template) {
          return $q.when(directive.template);
        }
        var cached = $templateCache.get(directive.templateUrl);
        if (cached) {
          return $q.when(cached);
        }
        return $http.get(directive.templateUrl).then(res => {
          return res.data;
        });
      }

      function addPanelAndCompile(name) {
        var child = angular.element(document.createElement(name));
        child.attr('dashboard', 'dashboard');
        child.attr('panel', 'panel');
        child.attr('row', 'row');
        $compile(child)(scope);

        elem.empty();
        elem.append(child);
      }

      function addPanel(name, Panel) {
        if (Panel.registered) {
          addPanelAndCompile(name);
          return;
        }

        if (Panel.promise) {
          Panel.promise.then(() => {
            addPanelAndCompile(name);
          });
          return;
        }

        var panelInstance = $injector.instantiate(Panel);
        var directive = panelInstance.getDirective();

        Panel.promise = getTemplate(directive).then(template => {
          directive.templateUrl = null;
          directive.template = `<grafana-panel ctrl="ctrl">${template}</grafana-panel>`;
          directiveModule.directive(attrs.$normalize(name), function() {
            return directive;
          });
          Panel.registered = true;
          addPanelAndCompile(name);
        });
      }

      var panelElemName = 'panel-directive-' + scope.panel.type;
      let panelInfo = config.panels[scope.panel.type];
      if (!panelInfo) {
        addPanel(panelElemName, UnknownPanel);
        return;
      }

      System.import(panelInfo.module).then(function(panelModule) {
        addPanel(panelElemName, panelModule.Panel);
      }).catch(err => {
        console.log('Panel err: ', err);
      });
    }
  };
}

directiveModule.directive('panelLoader', panelLoader);
