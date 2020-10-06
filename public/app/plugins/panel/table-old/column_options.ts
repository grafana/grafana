import _ from 'lodash';
import { getValueFormats } from '@grafana/data';

export class ColumnOptionsCtrl {
  panel: any;
  panelCtrl: any;
  colorModes: any;
  columnStyles: any;
  columnTypes: any;
  fontSizes: any;
  dateFormats: any;
  addColumnSegment: any;
  unitFormats: any;
  getColumnNames: any;
  activeStyleIndex: number;
  mappingTypes: any;

  alignTypes: any;
  static readonly alignTypesEnum = [
    { text: 'auto', value: '' },
    { text: 'left', value: 'left' },
    { text: 'center', value: 'center' },
    { text: 'right', value: 'right' },
  ];

  /** @ngInject */
  constructor($scope: any) {
    $scope.editor = this;

    this.activeStyleIndex = 0;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.unitFormats = getValueFormats();
    this.colorModes = [
      { text: 'Disabled', value: null },
      { text: 'Cell', value: 'cell' },
      { text: 'Value', value: 'value' },
      { text: 'Row', value: 'row' },
    ];
    this.columnTypes = [
      { text: 'Number', value: 'number' },
      { text: 'String', value: 'string' },
      { text: 'Date', value: 'date' },
      { text: 'Hidden', value: 'hidden' },
    ];
    this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    this.dateFormats = [
      { text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' },
      { text: 'YYYY-MM-DD HH:mm:ss.SSS', value: 'YYYY-MM-DD HH:mm:ss.SSS' },
      { text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a' },
      { text: 'MMMM D, YYYY LT', value: 'MMMM D, YYYY LT' },
      { text: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
    ];
    this.mappingTypes = [
      { text: 'Value to text', value: 1 },
      { text: 'Range to text', value: 2 },
    ];
    this.alignTypes = ColumnOptionsCtrl.alignTypesEnum;

    this.getColumnNames = () => {
      if (!this.panelCtrl.table) {
        return [];
      }
      return _.map(this.panelCtrl.table.columns, (col: any) => {
        return col.text;
      });
    };

    this.onColorChange = this.onColorChange.bind(this);
  }

  render() {
    this.panelCtrl.render();
  }

  setUnitFormat(column: any) {
    return (value: any) => {
      column.unit = value;
      this.panelCtrl.render();
    };
  }

  addColumnStyle() {
    const newStyleRule: object = {
      unit: 'short',
      type: 'number',
      alias: '',
      decimals: 2,
      colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
      colorMode: null,
      pattern: '',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      thresholds: [],
      mappingType: 1,
      align: 'auto',
    };

    const styles = this.panel.styles;
    const stylesCount = styles.length;
    let indexToInsert = stylesCount;

    // check if last is a catch all rule, then add it before that one
    if (stylesCount > 0) {
      const last = styles[stylesCount - 1];
      if (last.pattern === '/.*/') {
        indexToInsert = stylesCount - 1;
      }
    }

    styles.splice(indexToInsert, 0, newStyleRule);
    this.activeStyleIndex = indexToInsert;
  }

  removeColumnStyle(style: any) {
    this.panel.styles = _.without(this.panel.styles, style);
  }

  invertColorOrder(index: number) {
    const ref = this.panel.styles[index].colors;
    const copy = ref[0];
    ref[0] = ref[2];
    ref[2] = copy;
    this.panelCtrl.render();
  }

  onColorChange(style: any, colorIndex: number) {
    return (newColor: string) => {
      style.colors[colorIndex] = newColor;
      this.render();
    };
  }

  addValueMap(style: any) {
    if (!style.valueMaps) {
      style.valueMaps = [];
    }
    style.valueMaps.push({ value: '', text: '' });
    this.panelCtrl.render();
  }

  removeValueMap(style: any, index: number) {
    style.valueMaps.splice(index, 1);
    this.panelCtrl.render();
  }

  addRangeMap(style: any) {
    if (!style.rangeMaps) {
      style.rangeMaps = [];
    }
    style.rangeMaps.push({ from: '', to: '', text: '' });
    this.panelCtrl.render();
  }

  removeRangeMap(style: any, index: number) {
    style.rangeMaps.splice(index, 1);
    this.panelCtrl.render();
  }
}

export function columnOptionsTab() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/table-old/column_options.html',
    controller: ColumnOptionsCtrl,
  };
}
