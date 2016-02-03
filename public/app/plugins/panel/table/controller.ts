///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import * as FileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from '../../../features/panel/panel';
import {transformDataToTable} from './transformers';
import {tablePanelEditor} from './editor';

var panelDefaults = {
  targets: [{}],
  transform: 'timeseries_to_columns',
  pageSize: null,
  showHeader: true,
  styles: [
    {
      type: 'date',
      pattern: 'Time',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      unit: 'short',
      type: 'number',
      decimals: 2,
      colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"],
      colorMode: null,
      pattern: '/.*/',
      thresholds: [],
    }
  ],
  columns: [],
  scroll: true,
  fontSize: '100%',
  sort: {col: 0, desc: true},
};

export class TablePanelCtrl extends MetricsPanelCtrl {
  pageIndex: number;
  dataRaw: any;
  table: any;

  /** @ngInject */
  constructor($scope, $injector, private annotationsSrv) {
    super($scope, $injector);
    this.pageIndex = 0;

    if (this.panel.styles === void 0) {
      this.panel.styles = this.panel.columns;
      this.panel.columns = this.panel.fields;
      delete this.panel.columns;
      delete this.panel.fields;
    }

    _.defaults(this.panel, panelDefaults);
  }

  initEditMode() {
    super.initEditMode();
    this.addEditorTab('Options', tablePanelEditor, 2);
  }

  getExtendedMenu() {
    var menu = super.getExtendedMenu();
    menu.push({text: 'Export CSV', click: 'ctrl.exportCsv()'});
    return menu;
  }

  refreshData(datasource) {
    this.pageIndex = 0;

    if (this.panel.transform === 'annotations') {
      return this.annotationsSrv.getAnnotations(this.dashboard).then(annotations => {
        this.dataRaw = annotations;
        this.render();
      });
    }

    return this.issueQueries(datasource)
    .then(this.dataHandler.bind(this))
    .catch(err => {
      this.render();
      throw err;
    });
  }

  toggleColumnSort(col, colIndex) {
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

  dataHandler(results) {
    this.dataRaw = results.data;
    this.pageIndex = 0;
    this.render();
  }

  render() {
    // automatically correct transform mode
    // based on data
    if (this.dataRaw && this.dataRaw.length) {
      if (this.dataRaw[0].type === 'table') {
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

    this.table = transformDataToTable(this.dataRaw, this.panel);
    this.table.sort(this.panel.sort);
    this.broadcastRender(this.table);
  }

  exportCsv() {
    FileExport.exportTableDataToCsv(this.table);
  }
}
