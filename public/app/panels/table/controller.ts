///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import _ = require('lodash');
import moment = require('moment');
import PanelMeta = require('app/features/panel/panel_meta');

import {transformDataToTable} from './transformers';

export class TablePanelCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, $q, panelSrv, panelHelper, annotationsSrv) {
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
      pageSize: null,
      showHeader: true,
      styles: [
        {
          type: 'date',
          pattern: 'Time',
          dateFormat: 'YYYY-MM-DD HH:mm:ss',
        },
        {
          unit: 'short',
          type: 'number',
          decimals: 2,
          colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
          colorMode: null,
          pattern: '/.*/',
          thresholds: [],
        }
      ],
      columns: [],
      scroll: true,
      fontSize: '100%',
      sort: {col: 0, desc: true},
    };

    $scope.init = function() {
      if ($scope.panel.styles === void 0) {
        $scope.panel.styles = $scope.panel.columns;
        $scope.panel.columns = $scope.panel.fields;
        delete $scope.panel.columns;
        delete $scope.panel.fields;
      }

      _.defaults($scope.panel, panelDefaults);
      panelSrv.init($scope);
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      $scope.pageIndex = 0;

      if ($scope.panel.transform === 'annotations') {
        return annotationsSrv.getAnnotations($scope.dashboard).then(annotations => {
          $scope.dataRaw = annotations;
          $scope.render();
        });
      }

      return panelHelper.issueMetricQuery($scope, datasource)
      .then($scope.dataHandler, function(err) {
        $scope.render();
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
      $scope.pageIndex = 0;
      $scope.render();
    };

    $scope.render = function() {
      // automatically correct transform mode
      // based on data
      if ($scope.dataRaw && $scope.dataRaw.length) {
        if ($scope.dataRaw[0].type === 'table') {
          $scope.panel.transform = 'table';
        } else {
          if ($scope.dataRaw[0].type === 'docs') {
            $scope.panel.transform = 'json';
          } else {
            if ($scope.panel.transform === 'table' || $scope.panel.transform === 'json') {
              $scope.panel.transform = 'timeseries_to_rows';
            }
          }
        }
      }

      $scope.table = transformDataToTable($scope.dataRaw, $scope.panel);
      $scope.table.sort($scope.panel.sort);
      panelHelper.broadcastRender($scope, $scope.table, $scope.dataRaw);
    };

    $scope.init();
  }
}

