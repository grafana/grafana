define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('overviewPanel', function ($parse, $compile, $timeout, alertMgrSrv, healthSrv, datasourceSrv, contextSrv, backendSrv, $location, $q) {
      // var path = "'" + "/app/features/systemoverview/partials/system_overview_collapse.html" + "'";
      var predictionTpl = '<div ng-repeat="(name, panel) in panels" class="panel" panel-width>' + 
                          '<p ng-if="panel.tip">' +
                          '<i class="fa fa-info-circle" style="padding: 0 10px;"></i>' +
                          '<span ng-if="panel.tips.length">预计</span>' +
                          '<select ng-if="panel.tips.length" style="width:66px;" ng-model="panel.selectedOption" ng-change="changePre(panel.selectedOption)" ng-options="tip.time for tip in panel.tips">' +
                          '</select>' +
                          '{{panel.tip + panel.selectedOption.data}}' +
                          '</p>' +
                          '<panel-loader type="panel.type" class="panel-margin overview-panel"></panel-loader>' +
                          '</div>';
      var topNTpl = '<table class="table table-no-bordered" id="pidTable" data-sort-name="pid" data-sort-order="desc" data-pagination="true" data-row-style="rowStyle">'+
                    '<thead><tr><th data-field="pid" data-sortable="true">TopN 进程</th><th data-field="cpu" data-sortable="true">CPU</th><th data-field="mem" data-sortable="true">MEM</th></tr></thead>'+
                    '</table>';
      var template = predictionTpl + topNTpl;
      // var template = '<div ng-include="' + path + '"></div>'

      return {
        restrict: 'EA',
        // template: template,
        link: function (scope, elem, attr) {
          
          scope.$on('toggle-panel', function() {
            var $template = $(template);
            elem.html($template);

            $compile(elem.contents())(scope);
            $('#pidTable').bootstrapTable({
              data: scope.hostTopN,
              rowStyle: function (row, index) {
                if (row.pid.length > 130) {
                  return {
                    classes: 'table-row-height-fix'
                  }
                }
                return {};
              }
            });
          });

        }
      }
    });
  });