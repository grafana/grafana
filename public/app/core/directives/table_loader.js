define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('tableLoader', function ($compile) {
      var template = '<table class="table table-striped table-hack" '+
                     'data-pagination="true" data-page-size="5" data-sort-name="anomalyHealth" data-row-style="{{rowStyle}}">'+
                     '<thead><tr>'+
                     '<th data-field="name" data-sortable="true">指标</th>'+
                     '<th data-field="alertRuleSet" data-sortable="true">报警规则</th>'+
                     '<th data-field="alertLevel" data-sortable="true">报警级别</th>'+
                     '<th data-field="anomalyHealth" data-sortable="true">健康值</th>'+
                     '</tr></thead>'+
                     '</table>';

      return {
        restrict: 'EA',
        // template: template,
        link: function (scope, elem, attr) {
          scope.key = attr.key;
          
          scope.$on('load-table', function() {
            var $template = $(template);
            elem.html($template);
            $compile(elem.contents())(scope);

            $(".table-hack").bootstrapTable({
              data: scope.metric,
              rowStyle: function (row) {
                if (parseInt(row.anomalyHealth) === 0) {
                  return {
                    css: { "background-color": "rgba(246, 0, 0, 0.54)" }
                  };
                }
                if (parseInt(row.anomalyHealth) < 100) {
                  return {
                    css: { "background-color": "rgba(237,129,40,0.52)" }
                  };
                }
                return {};
              }
            });
          });

        }
      };
    });
  });