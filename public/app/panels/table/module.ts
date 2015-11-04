///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import moment = require('moment');
import PanelMeta = require('app/features/panel/panel_meta');
import TimeSeries = require('app/core/time_series');

import {TableModel} from './table_model';
import {transformers} from './transformers';

export class TablePanelCtrl {

  constructor($scope, $rootScope, $q, panelSrv, panelHelper) {
    $scope.ctrl = this;
    $scope.transformers = transformers;
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
      $scope.table = TableModel.transform($scope.dataRaw, $scope.panel);
      panelHelper.broadcastRender($scope, $scope.table);
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
      var panel = scope.panel;

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

      function appendTableRows(tbodyElem) {
        var rowElements = $(document.createDocumentFragment());
        var rowEnd = Math.min(panel.pageSize, data.rows.length);
        var rowStart = 0;

        for (var y = rowStart; y < rowEnd; y++) {
          var row = data.rows[y];
          var rowElem = $('<tr></tr>');
          for (var i = 0; i < data.columns.length; i++) {
            var colElem = $('<td>' + row[i] + '</td>');
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
