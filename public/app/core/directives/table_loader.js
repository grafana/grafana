define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('tableLoader', function ($parse, $compile, $timeout, alertMgrSrv, healthSrv, datasourceSrv, contextSrv, backendSrv, $location, $q) {
      var template = '<table class="table table-hover table-striped" id="tableLoader" data-pagination="true" data-page-size="5" '+
                     '<thead><tr><th data-field="name" data-sortable="true">指标</th><th data-field="anomalyHealth" data-sortable="true">分数</th></tr></thead>'+
                     '</table>';

      return {
        restrict: 'EA',
        // template: template,
        link: function (scope, elem, attr) {
          
          scope.$on('load-table', function() {
            var $template = $(template);
            elem.html($template);

            $compile(elem.contents())(scope);
            console.log(scope.metric)
            $('#tableLoader').bootstrapTable({
              data: scope.metric
            });
          });

        }
      }
    });
  });