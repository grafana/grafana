///<reference path="../../../headers/common.d.ts" />

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
    templateUrl: 'app/plugins/panels/table/module.html',
    controller: TablePanelCtrl,
    link: function(scope, elem) {
      var data;
      var panel = scope.panel;
      var pageCount = 0;
      var formaters = [];

      function getTableHeight() {
        var panelHeight = scope.height || scope.panel.height || scope.row.height;
        if (_.isString(panelHeight)) {
          panelHeight = parseInt(panelHeight.replace('px', ''), 10);
        }
        if (pageCount > 1) {
          panelHeight -= 28;
        }

        return (panelHeight - 60) + 'px';
      }

      function appendTableRows(tbodyElem) {
        var renderer = new TableRenderer(panel, data, scope.dashboard.timezone);
        tbodyElem.empty();
        tbodyElem.html(renderer.render(scope.pageIndex));
      }

      function switchPage(e) {
        var el = $(e.currentTarget);
        scope.pageIndex = (parseInt(el.text(), 10)-1);
        renderPanel();
      }

      function appendPaginationControls(footerElem) {
        footerElem.empty();

        var pageSize = panel.pageSize || 100;
        pageCount = Math.ceil(data.rows.length / pageSize);
        if (pageCount === 1) {
          return;
        }

        var startPage = Math.max(scope.pageIndex - 3, 0);
        var endPage = Math.min(pageCount, startPage + 9);

        var paginationList = $('<ul></ul>');

        for (var i = startPage; i < endPage; i++) {
          var activeClass = i === scope.pageIndex ? 'active' : '';
          var pageLinkElem = $('<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i+1) + '</a></li>');
          paginationList.append(pageLinkElem);
        }

        footerElem.append(paginationList);
      }

      function renderPanel() {
        var container = elem.find('.table-panel-container');
        var rootElem = elem.find('.table-panel-scroll');
        var tbodyElem = elem.find('tbody');
        var footerElem = elem.find('.table-panel-footer');

        appendTableRows(tbodyElem);

        container.css({'font-size': panel.fontSize});
        appendPaginationControls(footerElem);

        rootElem.css({'max-height': panel.scroll ? getTableHeight() : '' });
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

        renderPanel();
      });
    }
  };
}

angular.module('grafana.directives').directive('grafanaPanelTable', tablePanel);
angular.module('grafana.directives').directive('grafanaPanelTableEditor', tablePanelEditor);
