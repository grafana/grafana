///<reference path="../../../headers/common.d.ts" />


import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import angular from 'angular';

import {transformers} from './transformers';
import kbn from 'app/core/utils/kbn';

export class TablePanelEditorCtrl {
  panel: any;
  panelCtrl: any;
  transformers: any;
  colorModes: any;
  columnStyles: any;
  columnTypes: any;
  fontSizes: any;
  dateFormats: any;
  addColumnSegment: any;
  unitFormats: any;
  getColumnNames: any;

  /** @ngInject */
  constructor($scope, private $q, private uiSegmentSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.transformers = transformers;
    this.unitFormats = kbn.getUnitFormats();
    this.colorModes = [
      {text: 'Disabled', value: null},
      {text: 'Cell', value: 'cell'},
      {text: 'Value', value: 'value'},
      {text: 'Row', value: 'row'},
    ];
    this.columnTypes = [
      {text: 'Number', value: 'number'},
      {text: 'String', value: 'string'},
      {text: 'Date', value: 'date'},
    ];
    this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    this.dateFormats = [
      {text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss'},
      {text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a'},
      {text: 'MMMM D, YYYY LT',  value: 'MMMM D, YYYY LT'},
    ];

    this.addColumnSegment = uiSegmentSrv.newPlusButton();

    // this is used from bs-typeahead and needs to be instance bound
    this.getColumnNames = () => {
      if (!this.panelCtrl.table) {
        return [];
      }
      return _.map(this.panelCtrl.table.columns, function(col: any) {
        return col.text;
      });
    };
  }

  getColumnOptions() {
    if (!this.panelCtrl.dataRaw) {
      return this.$q.when([]);
    }
    var columns = this.transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
    var segments = _.map(columns, (c: any) => this.uiSegmentSrv.newSegment({value: c.text}));
    return this.$q.when(segments);
  }

  addColumn() {
    var columns = transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
    var column = _.findWhere(columns, {text: this.addColumnSegment.value});

    if (column) {
      this.panel.columns.push(column);
      this.render();
    }

    var plusButton = this.uiSegmentSrv.newPlusButton();
    this.addColumnSegment.html = plusButton.html;
    this.addColumnSegment.value = plusButton.value;
  }

  transformChanged() {
    this.panel.columns = [];
    this.render();
  }

  render() {
    this.panelCtrl.render();
  }

  removeColumn(column) {
    this.panel.columns = _.without(this.panel.columns, column);
    this.panelCtrl.render();
  }

  setUnitFormat(column, subItem) {
    column.unit = subItem.value;
    this.panelCtrl.render();
  };

  addColumnStyle() {
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

    this.panel.styles.push(angular.copy(columnStyleDefaults));
  }

  removeColumnStyle(style) {
    this.panel.styles = _.without(this.panel.styles, style);
  }

  invertColorOrder(index) {
    var ref = this.panel.styles[index].colors;
    var copy = ref[0];
    ref[0] = ref[2];
    ref[2] = copy;
    this.panelCtrl.render();
  }
}

/** @ngInject */
export function tablePanelEditor($q, uiSegmentSrv) {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/table/editor.html',
    controller: TablePanelEditorCtrl,
  };
}
