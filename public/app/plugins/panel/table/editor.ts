import _ from 'lodash';
import { transformers } from './transformers';

export class TablePanelEditorCtrl {
  panel: any;
  panelCtrl: any;
  transformers: any;
  fontSizes: any;
  addColumnSegment: any;
  getColumnNames: any;
  canSetColumns: boolean;
  columnsHelpMessage: string;
  canSetPivots: boolean;
  addPivotSegment: any;

  /** @ngInject */
  constructor($scope, private $q, private uiSegmentSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.transformers = transformers;
    this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    this.addColumnSegment = uiSegmentSrv.newPlusButton();
    this.addPivotSegment = uiSegmentSrv.newPlusButton();
    this.updateTransformHints();
  }

  updateTransformHints() {
    this.canSetColumns = false;
    this.columnsHelpMessage = '';
    this.canSetPivots = false;

    switch (this.panel.transform) {
      case 'timeseries_aggregations': {
        this.canSetColumns = true;
        break;
      }
      case 'json': {
        this.canSetColumns = true;
        break;
      }
      case 'timeseries_pivot_by': {
        this.canSetColumns = true;
        this.canSetPivots = true;
        break;
      }
      case 'table': {
        this.columnsHelpMessage = 'Columns and their order are determined by the data query';
      }
    }
  }

  getColumnOptions() {
    if (!this.panelCtrl.dataRaw) {
      return this.$q.when([]);
    }
    const columns = this.transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
    const segments = _.map(columns, (c: any) => this.uiSegmentSrv.newSegment({ value: c.text }));
    return this.$q.when(segments);
  }

  addColumn() {
    const columns = transformers[this.panel.transform].getColumns(this.panelCtrl.dataRaw);
    const column = _.find(columns, { text: this.addColumnSegment.value });

    if (column) {
      this.panel.columns.push(column);
      this.render();
    }

    const plusButton = this.uiSegmentSrv.newPlusButton();
    this.addColumnSegment.html = plusButton.html;
    this.addColumnSegment.value = plusButton.value;
  }

  transformChanged() {
    this.panel.columns = [];
    this.panel.pivots = [];
    if (this.panel.transform === 'timeseries_aggregations') {
      this.panel.columns.push({ text: 'Avg', value: 'avg' });
    }
    if (this.panel.transform === 'timeseries_pivot_by') {
      this.panel.columns.push({ text: 'Avg', value: 'avg' });
      this.panel.pivots = [];
    }

    this.updateTransformHints();
    this.render();
  }

  render() {
    this.panelCtrl.render();
  }

  removeColumn(column) {
    this.panel.columns = _.without(this.panel.columns, column);
    this.panelCtrl.render();
  }

  addPivot() {
    const pivots = transformers[this.panel.transform].getPivots(this.panelCtrl.dataRaw);
    const pivot = _.find(pivots, { text: this.addPivotSegment.value });
    this.panel.pivots = this.panel.pivots || [];
    if (pivot) {
      this.panel.pivots.push(pivot);
      this.render();
    }
    const plusButton = this.uiSegmentSrv.newPlusButton();
    this.addPivotSegment.html = plusButton.html;
    this.addPivotSegment.value = plusButton.value;
  }

  removePivot(pivot) {
    this.panel.pivots = _.without(this.panel.pivots, pivot);
    this.panelCtrl.render();
  }

  getPivotOptions() {
    if (!this.panelCtrl.dataRaw) {
      return this.$q.when([]);
    }
    const pivots = this.transformers[this.panel.transform].getPivots(this.panelCtrl.dataRaw);
    const uiSegments = _.map(pivots, (c: any) => this.uiSegmentSrv.newSegment({ value: c.text }));
    return this.$q.when(uiSegments);
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
