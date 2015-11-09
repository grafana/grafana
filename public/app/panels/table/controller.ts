///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import PanelMeta = require('app/features/panel/panel_meta');

import {TableModel} from './table_model';

export class TablePanelCtrl {

  constructor($scope, $rootScope, $q, panelSrv, panelHelper) {
    $scope.ctrl = this;
    $scope.pageIndex = 0;

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
      transform: 'timeseries_to_rows',
      pageSize: 50,
      showHeader: true,
      columns: [],
      fields: [],
      sort: {col: null, desc: true},
    };

    $scope.init = function() {
      _.defaults($scope.panel, panelDefaults);

      if ($scope.panel.columns.length === 0) {
      }

      panelSrv.init($scope);
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      return panelHelper.issueMetricQuery($scope, datasource)
      .then($scope.dataHandler, function(err) {
        $scope.seriesList = [];
        $scope.render([]);
        throw err;
      });
    };

    $scope.toggleColumnSort = function(col, colIndex) {
      if ($scope.panel.sort.col === colIndex) {
        if ($scope.panel.sort.desc) {
          $scope.panel.sort.desc = false;
        } else {
          $scope.panel.sort.col = null;
        }
      } else {
        $scope.panel.sort.col = colIndex;
        $scope.panel.sort.desc = true;
      }

      $scope.render();
    };

    $scope.dataHandler = function(results) {
      $scope.dataRaw = results.data;
      $scope.render();
    };

    $scope.render = function() {
      $scope.table = TableModel.transform($scope.dataRaw, $scope.panel);
      $scope.table.sort($scope.panel.sort);
      panelHelper.broadcastRender($scope, $scope.table, $scope.dataRaw);
    };

    $scope.init();
  }
}

