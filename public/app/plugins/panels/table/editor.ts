///<reference path="../../../headers/common.d.ts" />


import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import angular from 'angular';

import {transformers} from './transformers';
import kbn from 'app/core/utils/kbn';

export class TablePanelEditorCtrl {

  /** @ngInject */
  constructor($scope, $q, uiSegmentSrv) {
    $scope.transformers = transformers;
    $scope.unitFormats = kbn.getUnitFormats();
    $scope.colorModes = [
      {text: 'Disabled', value: null},
      {text: 'Cell', value: 'cell'},
      {text: 'Value', value: 'value'},
      {text: 'Row', value: 'row'},
    ];
    $scope.columnTypes = [
      {text: 'Number', value: 'number'},
      {text: 'String', value: 'string'},
      {text: 'Date', value: 'date'},
    ];
    $scope.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    $scope.dateFormats = [
      {text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss'},
      {text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a'},
      {text: 'MMMM D, YYYY LT',  value: 'MMMM D, YYYY LT'},
    ];

    $scope.addColumnSegment = uiSegmentSrv.newPlusButton();

    $scope.getColumnOptions = function() {
      if (!$scope.dataRaw) {
        return $q.when([]);
      }
      var columns = transformers[$scope.panel.transform].getColumns($scope.dataRaw);
      var segments = _.map(columns, (c: any) => uiSegmentSrv.newSegment({value: c.text}));
      return $q.when(segments);
    };

    $scope.addColumn = function() {
      var columns = transformers[$scope.panel.transform].getColumns($scope.dataRaw);
      var column = _.findWhere(columns, {text: $scope.addColumnSegment.value});

      if (column) {
        $scope.panel.columns.push(column);
        $scope.render();
      }

      var plusButton = uiSegmentSrv.newPlusButton();
      $scope.addColumnSegment.html = plusButton.html;
      $scope.addColumnSegment.value = plusButton.value;
    };

    $scope.transformChanged = function() {
      $scope.panel.columns = [];
      $scope.render();
    };

    $scope.removeColumn = function(column) {
      $scope.panel.columns = _.without($scope.panel.columns, column);
      $scope.render();
    };

    $scope.setUnitFormat = function(column, subItem) {
      column.unit = subItem.value;
      $scope.render();
    };

    $scope.addColumnStyle = function() {
      var columnStyleDefaults = {
        unit: 'short',
        type: 'number',
        decimals: 2,
        colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
        colorMode: null,
        pattern: '/.*/',
        dateFormat: 'YYYY-MM-DD HH:mm:ss',
        thresholds: [],
      };

      $scope.panel.styles.push(angular.copy(columnStyleDefaults));
    };

    $scope.removeColumnStyle = function(style) {
      $scope.panel.styles = _.without($scope.panel.styles, style);
    };

    $scope.getColumnNames = function() {
      if (!$scope.table) {
        return [];
      }
      return _.map($scope.table.columns, function(col: any) {
        return col.text;
      });
    };

    $scope.invertColorOrder = function(index) {
      var ref = $scope.panel.styles[index].colors;
      var copy = ref[0];
      ref[0] = ref[2];
      ref[2] = copy;
      $scope.render();
    };

  }
}


export function tablePanelEditor($q, uiSegmentSrv) {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'app/plugins/panels/table/editor.html',
    controller: TablePanelEditorCtrl,
  };
}
