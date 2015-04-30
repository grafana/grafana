define([
  'angular',
  'app',
  'lodash',
  'require',
  'components/panelmeta',
  'panels/table/table',
  'panels/table/pagingControl',
  '../../../directives/coloring'
],
  function (angular, app, _, require, PanelMeta) {
    'use strict';

    var module = angular.module('grafana.panels.table.rag', []);
    app.useModule(module);

    module.directive('grafanaPanelTableRag', function() {
      return {
        controller: 'TableRagPanelCtrl',
        templateUrl: 'app/panels/table/module.html'
      };
    });

    module.controller('TableRagPanelCtrl', function($scope, templateSrv, $sce, panelSrv, panelHelper) {
      $scope.tagColumnName = 'Name';
      $scope.tagValueColumnName = 'Value';

      $scope.panelMeta = new PanelMeta({
        panelName: 'Table',
        editIcon:  "fa fa-table",
        fullscreen: true,
        metricsEditor: true
      });

      $scope.panelMeta.addEditorTab('Options', 'app/panels/table/styleEditor.html');
      $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');
      $scope.panelMeta.addExtendedMenuItem('Export CSV', '', 'exportCsv()');

      // Set and populate defaults
      var _d = {
        title   : 'default title',
        datasource: null,
        content : "",
        style: {},
        targets: [{ rawQuery: true }],
        columnWidth: 'auto',
        decimalLimit: 'auto',
        showTimeAsDate: false,
        allowPaging: true,
        pageLimit: 20,
        allowSorting: true
      };

      $scope.permittedColumnWidthRange = _.range(40, 201);
      _.defaults($scope.panel, _d);

      $scope.init = function() {
        panelSrv.init($scope);
        $scope.ready = false;
        $scope.render();
      };

      $scope.refreshData = function(datasource) {
        panelHelper.updateTimeRange($scope);
        return panelHelper.issueMetricQuery($scope, datasource)
          .then($scope.dataHandler, function(err) {
            $scope.tableData = {values: [], columnOrder: []};
            $scope.render($scope.tableData);
            throw err;
          });
      };

      $scope.dataHandler = function(results) {
        $scope.tableData = dataTransform(results.data);
        $scope.render();
      };

      $scope.render = function() {
        $scope.$broadcast('render', $scope.tableData);
      };

      $scope.shouldHidePaginationControl = function() {
        return $scope.dashboard.refresh || !$scope.panel.allowPaging;
      };

      $scope.shouldHideTable = function() {
        return !$scope.tableData || !$scope.tableData.values.length;
      };

      $scope.init();

      /**
       * Transforms the raw datasource query into an array of objects
       * The column order is retained since JS Dictionaries are unordered
       * @param results
       * @returns {{values: Array, columnOrder: Array}}
       */
      function dataTransform(results) {
        function getTagName(rawName) {
          var tagRegex = /\{.*?: ?(.*?)\}/g;
          var match = tagRegex.exec(rawName);
          return match !== null ? match[1] : rawName;
        }

        var rowValues = _.map(results, function(queryResult) {
          var curRowName = getTagName(queryResult.target);
          var rowData = queryResult.datapoints[0]; // each grouped row will only have one array of datapoints (for now)
          var value = rowData[0]; // index 0 is the value, index 1 is the timestamp which is not needed here
          var result = {};
          result[$scope.tagColumnName] = curRowName;
          result[$scope.tagValueColumnName] = value;
          return result;
        });

        return {
          values: rowValues,
          columnOrder: [$scope.tagColumnName, $scope.tagValueColumnName]
        };
      }
    });
  });
