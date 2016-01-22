///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';

import {unknownPanelDirective} from '../../plugins/panel/unknown/module';

var directiveModule = angular.module('grafana.directives');

/** @ngInject */
function panelLoader($compile, dynamicDirectiveSrv, $http, $q) {
  return {
    restrict: 'E',
    scope: {
      dashboard: "=",
      row: "=",
      panel: "="
    },
    link: function(scope, elem, attrs) {

      function getTemplate(component) {
        if (component.template) {
          return $q.when(component.template);
        }
        return $http.get(component.templateUrl).then(res => {
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

      function addPanel(name, directive) {
        if (!directive.registered) {
          getTemplate(directive).then(template => {
            directive.templateUrl = null;
            directive.template = `<grafana-panel ctrl="ctrl">${template}</grafana-panel>`;
            directive.controllerAs =  'ctrl';
            directive.bindToController =  true;
            directive.scope = {
              dashboard: "=",
              panel: "=",
              row: "="
            };

            directiveModule.directive(attrs.$normalize(name), function() {
              return directive;
            });
            directive.registered = true;
            addPanelAndCompile(name);
          });
        }
        addPanelAndCompile(name);
      }

      var panelElemName = 'panel-directive-' + scope.panel.type;
      let panelInfo = config.panels[scope.panel.type];
      if (!panelInfo) {
        addPanel(panelElemName, unknownPanelDirective);
      }

      System.import(panelInfo.module).then(function(panelModule) {
        addPanel(panelElemName, panelModule.panel);
      }).catch(err => {
        console.log('Panel err: ', err);
      });
    }
  };
}

angular.module('grafana.directives').directive('panelLoader', panelLoader);
