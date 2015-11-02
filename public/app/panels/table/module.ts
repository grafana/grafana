///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import moment = require('moment');
import PanelMeta = require('app/features/panel/panel_meta');
import TimeSeries = require('app/core/time_series');

var panelDefaults = {
  targets: [{}],
};

export class TablePanelCtrl {

  constructor($scope, $rootScope, $q, panelSrv, panelHelper) {
    $scope.ctrl = this;

    $scope.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true,
    });

    $scope.panelMeta.addEditorTab('Options', 'app/panels/table/options.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    _.defaults($scope.panel, panelDefaults);

    $scope.refreshData = function(datasource) {
      var data = {
        columns: [],
        rows: [],
      };

      data.columns.push({text: 'Time'});
      data.columns.push({text: 'Value'});
      data.columns.push({text: 'Value2'});
      data.rows.push([
        moment().format('LLL'), 17.2, 15.12
      ]);
      data.rows.push([
        moment().format('LLL'), 12.2, 122.3244
      ]);
      data.rows.push([
        moment().format('LLL'), 111.2, 2312.22
      ]);

      panelHelper.broadcastRender($scope, data);

      // panelHelper.updateTimeRange($scope);
      //
      // return panelHelper.issueMetricQuery($scope, datasource)
      //   .then($scope.dataHandler, function(err) {
      //     $scope.seriesList = [];
      //     $scope.render([]);
      //     throw err;
      //   });
    };

    $scope.dataHandler = function(results) {
      $scope.seriesList = _.map(results.data, $scope.seriesHandler);
      panelHelper.broadcastRender($scope, $scope.seriesList);
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;
      var colorIndex = index % $rootScope.colors.length;
      var color = $scope.panel.aliasColors[alias] || $rootScope.colors[colorIndex];

      var series = new TimeSeries({
        datapoints: datapoints,
        alias: alias,
        color: color,
      });

      return series;
    };

    panelSrv.init($scope);
  }
}

export function tablePanelDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/panels/table/module.html',
    controller: TablePanelCtrl,
    link: function(scope, elem) {
      var data;

      function renderPanel() {
        var rootDiv = elem.find('.table-panel-container');
        var tableDiv = $('<table class="table-panel"></table>');
        var i, y, rowElem, colElem, column, row;

        rowElem = $('<tr></tr>');
        for (i = 0; i < data.columns.length; i++) {
          column = data.columns[i];
          colElem = $('<td>' + column.text + '</td>');
          rowElem.append(colElem);
        }

        tableDiv.append(rowElem);

        for (y = 0; y < data.rows.length; y++) {
          row = data.rows[y];
          rowElem = $('<tr></tr>')
          for (i = 0; i < data.columns.length; i++) {
            colElem = $('<td>' + row[i] + '</td>');
            rowElem.append(colElem);
          }
          tableDiv.append(rowElem);
        }

        rootDiv.empty();
        rootDiv.append(tableDiv);
      }

      scope.$on('render', function(event, renderData) {
        data = renderData || data;
        if (!data) {
          scope.get_data();
          return;
        }
        renderPanel();
      });
    }
  };
}

angular.module('grafana.directives').directive('grafanaPanelTable', tablePanelDirective);

