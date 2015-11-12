
///<reference path="../../headers/common.d.ts" />

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
    templateUrl: 'app/panels/table/editor.html',
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

      scope.updateJsonFieldsMenu = function(data) {
        scope.jsonFieldsMenu = [];
        if (!data || data.length === 0) {
          return;
        }

        var names =  {};
        for (var i = 0; i < data.length; i++) {
          var series = data[i];
          if (series.type !== 'docs') {
            continue;
          }

          for (var y = 0; y < series.datapoints.length; y++) {
            var doc = series.datapoints[y];
            for (var propName in doc) {
              names[propName] = true;
            }
          }
        }

        _.each(names, function(value, key) {
          scope.jsonFieldsMenu.push({text: key});
        });
      };

      scope.updateJsonFieldsMenu(scope.dataRaw);

      scope.$on('render', function(event, table, rawData) {
        scope.updateJsonFieldsMenu(rawData);
      });

      scope.addJsonField = function(menuItem) {
        scope.panel.fields.push({name: menuItem.text});
        scope.render();
      };

      scope.removeJsonField = function(field) {
        scope.panel.fields = _.without(scope.panel.fields, field);
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
          thresholds: [],
        };

        scope.panel.columns.push(angular.copy(columnStyleDefaults));
      };

      scope.removeColumnStyle = function(col) {
        scope.panel.columns = _.without(scope.panel.columns, col);
      };

      scope.getColumnNames = function() {
        if (!scope.table) {
          return [];
        }
        return _.map(scope.table.columns, function(col: any) {
          return col.text;
        });
      };
    }
  };
}

