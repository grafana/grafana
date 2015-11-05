///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import kbn = require('app/core/utils/kbn');
import PanelMeta = require('app/features/panel/panel_meta');

import {TableModel} from './table_model';
import {transformers} from './transformers';

export class TablePanelCtrl {

  constructor($scope, $rootScope, $q, panelSrv, panelHelper) {
    $scope.ctrl = this;
    $scope.transformers = transformers;
    $scope.pageIndex = 0;
    $scope.unitFormats = kbn.getUnitFormats();
    $scope.colorModes = {
      'cell': {text: 'Cell'},
      'value': {text: 'Value'},
      'row': {text: 'Row'},
    };

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
    };

    $scope.init = function() {
      _.defaults($scope.panel, panelDefaults);

      if ($scope.panel.columns.length === 0) {
        $scope.addColumnStyle();
      }

      panelSrv.init($scope);
    };

    $scope.setUnitFormat = function(column, subItem) {
      column.unit = subItem.value;
      $scope.render();
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

    $scope.dataHandler = function(results) {
      $scope.dataRaw = results.data;
      $scope.render();
    };

    $scope.render = function() {
      $scope.table = TableModel.transform($scope.dataRaw, $scope.panel);
      panelHelper.broadcastRender($scope, $scope.table);
    };

    $scope.getColumnNames = function() {
      if (!$scope.table) {
        return [];
      }
      return _.map($scope.table.columns, function(col: any) {
        return col.text;
      });
    };

    $scope.addColumnStyle = function() {
      var columnStyleDefaults = {
        unit: 'short',
        decimals: 2,
        colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
        pattern: '/.*/',
        colorMode: 'value',
      };

      $scope.panel.columns.push(angular.copy(columnStyleDefaults));
    };

    $scope.removeColumnStyle = function(col) {
      $scope.panel.columns = _.without($scope.panel.columns, col);
    };

    $scope.init();
  }
}

