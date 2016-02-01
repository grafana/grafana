///<reference path="../../../headers/common.d.ts" />

import kbn = require('app/core/utils/kbn');

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import {PanelDirective} from '../../../features/panel/panel';
import {TablePanelCtrl} from './controller';
import {TableRenderer} from './renderer';

class TablePanel extends PanelDirective {
  templateUrl = 'public/app/plugins/panel/table/module.html';
  controller = TablePanelCtrl;

  link(scope, elem, attrs, ctrl) {
    var data;
    var panel = ctrl.panel;
    var pageCount = 0;
    var formaters = [];

    function getTableHeight() {
      var panelHeight = ctrl.height || ctrl.panel.height || ctrl.row.height;
      if (_.isString(panelHeight)) {
        panelHeight = parseInt(panelHeight.replace('px', ''), 10);
      }
      if (pageCount > 1) {
        panelHeight -= 28;
      }

      return (panelHeight - 60) + 'px';
    }

    function appendTableRows(tbodyElem) {
      var renderer = new TableRenderer(panel, data, ctrl.dashboard.timezone);
      tbodyElem.empty();
      tbodyElem.html(renderer.render(ctrl.pageIndex));
    }

    function switchPage(e) {
      var el = $(e.currentTarget);
      ctrl.pageIndex = (parseInt(el.text(), 10)-1);
      renderPanel();
    }

    function appendPaginationControls(footerElem) {
      footerElem.empty();

      var pageSize = panel.pageSize || 100;
      pageCount = Math.ceil(data.rows.length / pageSize);
      if (pageCount === 1) {
        return;
      }

      var startPage = Math.max(ctrl.pageIndex - 3, 0);
      var endPage = Math.min(pageCount, startPage + 9);

      var paginationList = $('<ul></ul>');

      for (var i = startPage; i < endPage; i++) {
        var activeClass = i === ctrl.pageIndex ? 'active' : '';
        var pageLinkElem = $('<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i+1) + '</a></li>');
        paginationList.append(pageLinkElem);
      }

      footerElem.append(paginationList);
    }

    function renderPanel() {
      var panelElem = elem.parents('.panel');
      var rootElem = elem.find('.table-panel-scroll');
      var tbodyElem = elem.find('tbody');
      var footerElem = elem.find('.table-panel-footer');

      elem.css({'font-size': panel.fontSize});
      panelElem.addClass('table-panel-wrapper');

      appendTableRows(tbodyElem);
      appendPaginationControls(footerElem);

      rootElem.css({'max-height': panel.scroll ? getTableHeight() : '' });
    }

    elem.on('click', '.table-panel-page-link', switchPage);

    scope.$on('$destroy', function() {
      elem.off('click', '.table-panel-page-link');
    });

    scope.$on('render', function(event, renderData) {
      data = renderData || data;
      if (data) {
        renderPanel();
      }
    });
  }
}

export {
  TablePanel,
  TablePanel as Panel
};
