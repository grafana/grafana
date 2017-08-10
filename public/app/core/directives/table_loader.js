define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('tableLoader', function ($compile, $http) {
      return {
        restrict: 'EA',
        link: function (scope, elem, attr) {
          scope.key = attr.key;
          var templateUrl = attr.template;

          var template = $http.get(templateUrl, { cache: true }).then(function (res) {
            return res.data;
          });

          scope.$on('load-table', function() {
            template.then(function (response) {
              var $template = $(response);
              elem.html($template);

              $compile(elem.contents())(scope);

              $(".table-hack").bootstrapTable({
                data: scope.bsTableData,
                onClickCell: function (field, value, row, $element) {
                  if (field == 'anomalyHealth') {
                    scope.showModal(7, row.name, scope.key);
                  }
                }
              });
              $('.table-hack').tooltip({
                selector: '[data-toggle="tooltip"]',
                container: 'body'
              });
            });
          });

        }
      };
    });
  });