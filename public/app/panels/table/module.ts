///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import kbn = require('app/core/utils/kbn');

import {TablePanelCtrl} from './controller';

export function tablePanelDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'app/panels/table/module.html',
    controller: TablePanelCtrl,
    link: function(scope, elem) {
      var data;
      var panel = scope.panel;
      var formaters = [];

      function getTableHeight() {
        var panelHeight = scope.height || scope.panel.height || scope.row.height;
        if (_.isString(panelHeight)) {
          panelHeight = parseInt(panelHeight.replace('px', ''), 10);
        }

        return (panelHeight - 40) + 'px';
      }

      function appendTableHeader(tableElem) {
        var rowElem = $('<tr></tr>');
        for (var i = 0; i < data.columns.length; i++) {
          var column = data.columns[i];
          var colElem = $('<th>' + column.text + '</th>');
          rowElem.append(colElem);
        }

        var headElem = $('<thead></thead>');
        headElem.append(rowElem);
        headElem.appendTo(tableElem);
      }

      function createColumnFormater(style) {
        return function(v) {
          if (v === null) {
            return '-';
          }
          if (_.isString(v)) {
            return v;
          }
          let valueFormater = kbn.valueFormats[style.unit];
          return valueFormater(v, style.decimals);
        };
      }

      function formatColumnValue(colIndex, value) {
        if (formaters[colIndex]) {
          return formaters[colIndex](value);
        }

        for (let i = 0; i < panel.columns.length; i++) {
          let style = panel.columns[i];
          let column = data.columns[colIndex];
          var regex = kbn.stringToJsRegex(style.pattern);
          if (column.text.match(regex)) {
            formaters[colIndex] = createColumnFormater(style);
            return formaters[colIndex](value);
          }
        }

        formaters[colIndex] = function(v) {
          return v;
        };

        return formaters[colIndex](value);
      }

      function appendTableRows(tbodyElem) {
        let rowElements = $(document.createDocumentFragment());
        let rowEnd = Math.min(panel.pageSize, data.rows.length);
        let rowStart = 0;


        for (var y = rowStart; y < rowEnd; y++) {
          let row = data.rows[y];
          let rowElem = $('<tr></tr>');
          for (var i = 0; i < data.columns.length; i++) {
            var colValue = formatColumnValue(i, row[i]);
            let colElem = $('<td> ' + colValue +  '</td>');
            rowElem.append(colElem);
          }
          rowElements.append(rowElem);
        }

        tbodyElem.empty();
        tbodyElem.append(rowElements);
      }

      function appendPaginationControls(footerElem) {
        var paginationList = $('<ul></ul>');

        var pageCount = data.rows.length / panel.pageSize;
        for (var i = 0; i < pageCount; i++) {
          var pageLinkElem = $('<li><a href="#">' + (i+1) + '</a></li>');
          paginationList.append(pageLinkElem);
        }

        var nextLink = $('<li><a href="#">»</a></li>');
        paginationList.append(nextLink);

        footerElem.empty();
        footerElem.append(paginationList);
      }

      function renderPanel() {
        var rootElem = elem.find('.table-panel-scroll');
        var tbodyElem = elem.find('tbody');
        var footerElem = elem.find('.table-panel-footer');

        appendTableRows(tbodyElem);

        rootElem.css({'max-height': getTableHeight()});
        appendPaginationControls(footerElem);
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
