import _ from 'lodash';
import $ from 'jquery';
import { MetricsPanelCtrl } from 'app/plugins/sdk';
import config from 'app/core/config';
import { transformDataToTable } from './transformers';
import { tablePanelEditor } from './editor';
import { columnOptionsTab } from './column_options';
import { TableRenderer } from './renderer';
import { isTableData, PanelEvents, PanelPlugin, PanelProps } from '@grafana/data';
import { dispatch } from 'app/store/store';
import { ComponentType } from 'react';
import { applyFilterFromTable } from 'app/features/variables/adhoc/actions';

export class TablePanelCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  pageIndex: number;
  dataRaw: any;
  table: any;
  renderer: any;

  panelDefaults: any = {
    targets: [{}],
    transform: 'timeseries_to_columns',
    pageSize: null,
    showHeader: true,
    styles: [
      {
        type: 'date',
        pattern: 'Time',
        alias: 'Time',
        dateFormat: 'YYYY-MM-DD HH:mm:ss',
        align: 'auto',
      },
      {
        unit: 'short',
        type: 'number',
        alias: '',
        decimals: 2,
        colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
        colorMode: null,
        pattern: '/.*/',
        thresholds: [],
        align: 'right',
      },
    ],
    columns: [],

    fontSize: '100%',
    sort: { col: 0, desc: true },
  };

  /** @ngInject */
  constructor($scope: any, $injector: any, private annotationsSrv: any, private $sanitize: any) {
    super($scope, $injector);

    this.pageIndex = 0;

    if (this.panel.styles === void 0) {
      this.panel.styles = this.panel.columns;
      this.panel.columns = this.panel.fields;
      delete this.panel.columns;
      delete this.panel.fields;
    }

    _.defaults(this.panel, this.panelDefaults);

    this.events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this));
    this.events.on(PanelEvents.dataSnapshotLoad, this.onDataReceived.bind(this));
    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Options', tablePanelEditor, 2);
    this.addEditorTab('Column Styles', columnOptionsTab, 3);
  }

  issueQueries(datasource: any) {
    this.pageIndex = 0;

    if (this.panel.transform === 'annotations') {
      return this.annotationsSrv
        .getAnnotations({
          dashboard: this.dashboard,
          panel: this.panel,
          range: this.range,
        })
        .then((anno: any) => {
          this.loading = false;
          this.dataRaw = anno;
          this.pageIndex = 0;
          this.render();
          return { data: this.dataRaw }; // Not used
        });
    }

    return super.issueQueries(datasource);
  }

  onDataReceived(dataList: any) {
    this.dataRaw = dataList;
    this.pageIndex = 0;

    // automatically correct transform mode based on data
    if (this.dataRaw && this.dataRaw.length) {
      if (isTableData(this.dataRaw[0])) {
        this.panel.transform = 'table';
      } else {
        if (this.dataRaw[0].type === 'docs') {
          this.panel.transform = 'json';
        } else {
          if (this.panel.transform === 'table' || this.panel.transform === 'json') {
            this.panel.transform = 'timeseries_to_rows';
          }
        }
      }
    }

    this.render();
  }

  render() {
    this.table = transformDataToTable(this.dataRaw, this.panel);
    this.table.sort(this.panel.sort);

    this.renderer = new TableRenderer(
      this.panel,
      this.table,
      this.dashboard.getTimezone(),
      this.$sanitize,
      this.templateSrv,
      config.theme.type
    );

    return super.render(this.table);
  }

  toggleColumnSort(col: any, colIndex: any) {
    // remove sort flag from current column
    if (this.table.columns[this.panel.sort.col]) {
      this.table.columns[this.panel.sort.col].sort = false;
    }

    if (this.panel.sort.col === colIndex) {
      if (this.panel.sort.desc) {
        this.panel.sort.desc = false;
      } else {
        this.panel.sort.col = null;
      }
    } else {
      this.panel.sort.col = colIndex;
      this.panel.sort.desc = true;
    }
    this.render();
  }

  link(scope: any, elem: JQuery, attrs: any, ctrl: TablePanelCtrl) {
    let data: any;
    const panel = ctrl.panel;
    let pageCount = 0;

    function getTableHeight() {
      let panelHeight = ctrl.height;

      if (pageCount > 1) {
        panelHeight -= 26;
      }

      return panelHeight - 31 + 'px';
    }

    function appendTableRows(tbodyElem: JQuery) {
      ctrl.renderer.setTable(data);
      tbodyElem.empty();
      tbodyElem.html(ctrl.renderer.render(ctrl.pageIndex));
    }

    function switchPage(e: any) {
      const el = $(e.currentTarget);
      ctrl.pageIndex = parseInt(el.text(), 10) - 1;
      renderPanel();
    }

    function appendPaginationControls(footerElem: JQuery) {
      footerElem.empty();

      const pageSize = panel.pageSize || 100;
      pageCount = Math.ceil(data.rows.length / pageSize);
      if (pageCount === 1) {
        return;
      }

      const startPage = Math.max(ctrl.pageIndex - 3, 0);
      const endPage = Math.min(pageCount, startPage + 9);

      const paginationList = $('<ul></ul>');

      for (let i = startPage; i < endPage; i++) {
        const activeClass = i === ctrl.pageIndex ? 'active' : '';
        const pageLinkElem = $(
          '<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i + 1) + '</a></li>'
        );
        paginationList.append(pageLinkElem);
      }

      footerElem.append(paginationList);
    }

    function renderPanel() {
      const panelElem = elem.parents('.panel-content');
      const rootElem = elem.find('.table-panel-scroll');
      const tbodyElem = elem.find('tbody');
      const footerElem = elem.find('.table-panel-footer');

      elem.css({ 'font-size': panel.fontSize });
      panelElem.addClass('table-panel-content');

      appendTableRows(tbodyElem);
      appendPaginationControls(footerElem);

      rootElem.css({ 'max-height': getTableHeight() });
    }

    // hook up link tooltips
    elem.tooltip({
      selector: '[data-link-tooltip]',
    });

    function addFilterClicked(e: any) {
      const filterData = $(e.currentTarget).data();
      const options = {
        datasource: panel.datasource,
        key: data.columns[filterData.column].text,
        value: data.rows[filterData.row][filterData.column],
        operator: filterData.operator,
      };

      dispatch(applyFilterFromTable(options));
    }

    elem.on('click', '.table-panel-page-link', switchPage);
    elem.on('click', '.table-panel-filter-link', addFilterClicked);

    const unbindDestroy = scope.$on('$destroy', () => {
      elem.off('click', '.table-panel-page-link');
      elem.off('click', '.table-panel-filter-link');
      unbindDestroy();
    });

    ctrl.events.on(PanelEvents.render, (renderData: any) => {
      data = renderData || data;
      if (data) {
        renderPanel();
      }
      ctrl.renderingCompleted();
    });
  }
}

export const plugin = new PanelPlugin((null as unknown) as ComponentType<PanelProps<any>>);
plugin.angularPanelCtrl = TablePanelCtrl;
plugin.setNoPadding();
