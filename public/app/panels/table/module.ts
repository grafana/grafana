///<reference path="../../headers/common.d.ts" />

import angular = require('angular');
import $ = require('jquery');
import _ = require('lodash');
import kbn = require('app/core/utils/kbn');
import moment = require('moment');

import {TablePanelCtrl} from './controller';
import {TableRenderer} from './renderer';
import {tablePanelEditor} from './editor';

export function tablePanel() {
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

      function appendTableRows(tbodyElem) {
        var renderer = new TableRenderer(panel, data, scope.dashboard.timezone);
        tbodyElem.empty();
        tbodyElem.html(renderer.render(0));
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

angular.module('grafana.directives').directive('grafanaPanelTable', tablePanel);
angular.module('grafana.directives').directive('grafanaPanelTableEditor', tablePanelEditor);
