define([
    'jquery',
    'lodash',
    '../core_module',
    'jquery.flot',
    'jquery.flot.pie',
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('overviewPanel', function ($parse, alertMgrSrv, healthSrv, datasourceSrv, contextSrv, backendSrv, $location, $q) {
      return {
        restrict: 'E',
        link: function (scope, elem, attr) {
          scope.init = function () {
            // 
          };
          var getter = $parse(attr.sys), system = getter(scope);
          contextSrv.user.systemId = system;
          
          // prediction
          var getPrediction = function () {
            
          };



        }
      }
    });
  });