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
      var pageIndex = 0;

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
        tbodyElem.html(renderer.render(pageIndex));
      }

      function switchPage(e) {
        var el = $(e.currentTarget);
        pageIndex = (parseInt(el.text(), 10)-1);
        renderPanel();
      }

      function appendPaginationControls(footerElem) {
        footerElem.empty();

        var pageCount = Math.ceil(data.rows.length / panel.pageSize);
        if (pageCount === 1) {
          return;
        }

        var startPage = Math.max(pageIndex - 3, 0);
        var endPage = Math.min(pageCount, startPage + 9);

        var paginationList = $('<ul></ul>');

        var prevLink = $('<li><a class="table-panel-page-link pointer">«</a></li>');
        paginationList.append(prevLink);

        for (var i = startPage; i < endPage; i++) {
          var activeClass = i === pageIndex ? 'active' : '';
          var pageLinkElem = $('<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i+1) + '</a></li>');
          paginationList.append(pageLinkElem);
        }

        var nextLink = $('<li><a href="#">»</a></li>');
        paginationList.append(nextLink);

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

      elem.on('click', '.table-panel-page-link', switchPage);

      scope.$on('$destroy', function() {
        elem.off('click', '.table-panel-page-link');
      });

      scope.$on('render', function(event, renderData) {
        data = renderData || data;
        if (!data) {
          scope.get_data();
          return;
        }

        pageIndex = 0;
        renderPanel();
      });
    }
  };
}

angular.module('grafana.directives').directive('grafanaPanelTable', tablePanel);
angular.module('grafana.directives').directive('grafanaPanelTableEditor', tablePanelEditor);
