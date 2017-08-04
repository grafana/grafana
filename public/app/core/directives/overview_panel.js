define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('overviewPanel', function ($parse, $compile, $http) {
      return {
        restrict: 'EA',
        link: function (scope, elem, attr) {
          var templateUrl = attr.template;

          var template = $http.get(templateUrl, { cache: true }).then(function (res) {
            return res.data;
          });

          scope.$on('toggle-panel', function(e, args) {
            template.then(function (response) {
              var $template = $(response);
              elem.html($template);

              $compile(elem.contents())(scope);
            });
          });
        }
      };
    });
  });