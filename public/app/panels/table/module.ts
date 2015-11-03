///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import moment = require('moment');
import PanelMeta = require('app/features/panel/panel_meta');
import TimeSeries = require('app/core/time_series');
import {TableModel, transformers} from './table_model';

export class TablePanelCtrl {

  constructor($scope, $rootScope, $q, panelSrv, panelHelper) {
    $scope.ctrl = this;
    $scope.transformers = transformers;

    $scope.panelMeta = new PanelMeta({
      panelName: 'Table',
      editIcon:  "fa fa-table",
      fullscreen: true,
      metricsEditor: true,
    });

    $scope.panelMeta.addEditorTab('Options', 'app/panels/table/options.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    var panelDefaults = {
      targets: [{}],
      transform: 'timeseries_to_rows'
    };

    _.defaults($scope.panel, panelDefaults);

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      return panelHelper.issueMetricQuery($scope, datasource)
      .then($scope.dataHandler, function(err) {
        $scope.seriesList = [];
        $scope.render([]);
        throw err;
      });
    };

    $scope.dataHandler = function(results) {
      $scope.dataRaw = results.data;
      $scope.render();
    };

    $scope.render = function() {
      $scope.tableModel = TableModel.transform($scope.dataRaw, $scope.panel);
      panelHelper.broadcastRender($scope, $scope.tableModel);
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

      function getTableHeight() {
        var panelHeight = scope.height || scope.panel.height || scope.row.height;
        if (_.isString(panelHeight)) {
          panelHeight = parseInt(panelHeight.replace('px', ''), 10);
        }

        return (panelHeight - 40) + 'px';
      }

      function renderPanel() {
        var rootDiv = elem.find('.table-panel-container');
        var tableDiv = $('<table class="gf-table-panel"></table>');
        var i, y, rowElem, colElem, column, row;

        rowElem = $('<tr></tr>');
        for (i = 0; i < data.columns.length; i++) {
          column = data.columns[i];
          colElem = $('<th>' + column.text + '</th>');
          rowElem.append(colElem);
        }

        var headElem = $('<thead></thead>');
        headElem.append(rowElem);

        var tbodyElem = $('<tbody></tbody>');
        for (y = 0; y < data.rows.length; y++) {
          row = data.rows[y];
          rowElem = $('<tr></tr>');
          for (i = 0; i < data.columns.length; i++) {
            colElem = $('<td>' + row[i] + '</td>');
            rowElem.append(colElem);
          }
          tbodyElem.append(rowElem);
        }

        tableDiv.append(headElem);
        tableDiv.append(tbodyElem);

        rootDiv.css({'max-height': getTableHeight()});

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

