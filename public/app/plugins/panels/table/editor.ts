///<reference path="../../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import kbn = require('app/core/utils/kbn');
import moment = require('moment');

import {transformers} from './transformers';

export function tablePanelEditor() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'app/plugins/panels/table/editor.html',
    link: function(scope, elem) {
      scope.transformers = transformers;
      scope.unitFormats = kbn.getUnitFormats();
      scope.colorModes = [
        {text: 'Disabled', value: null},
        {text: 'Cell', value: 'cell'},
        {text: 'Value', value: 'value'},
        {text: 'Row', value: 'row'},
      ];
      scope.columnTypes = [
        {text: 'Number', value: 'number'},
        {text: 'String', value: 'string'},
        {text: 'Date', value: 'date'},
      ];
      scope.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
      scope.dateFormats = [
         {text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss'},
         {text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a'},
         {text: 'MMMM D, YYYY LT',  value: 'MMMM D, YYYY LT'},
      ];

      scope.updateColumnsMenu = function(data) {
        scope.columnsMenu = transformers[scope.panel.transform].getColumns(data);
        scope.showColumnOptions = true;
     };

      scope.$on('render', function(event, table, rawData) {
        scope.updateColumnsMenu(rawData);
      });

      scope.addColumn = function(menuItem) {
        scope.panel.columns.push({text: menuItem.text, value: menuItem.value});
        scope.render();
      };

      scope.transformChanged = function() {
        scope.panel.columns = [];
        scope.updateColumnsMenu();
        scope.render();
      };

      scope.removeColumn = function(column) {
        scope.panel.columns = _.without(scope.panel.columns, column);
        scope.render();
      };

      scope.setUnitFormat = function(column, subItem) {
        column.unit = subItem.value;
        scope.render();
      };

      scope.addColumnStyle = function() {
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

        scope.panel.styles.push(angular.copy(columnStyleDefaults));
      };

      scope.removeColumnStyle = function(style) {
        scope.panel.styles = _.without(scope.panel.styles, style);
      };

      scope.getColumnNames = function() {
        if (!scope.table) {
          return [];
        }
        return _.map(scope.table.columns, function(col: any) {
          return col.text;
        });
      };

      scope.updateColumnsMenu(scope.dataRaw);
    }
  };
}

