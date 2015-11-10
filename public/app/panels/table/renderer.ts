///<reference path="../../headers/common.d.ts" />

import _ = require('lodash');
import kbn = require('app/core/utils/kbn');
import moment = require('moment');

export class TableRenderer {
  formaters: any[];
  colorState: any;

  constructor(private panel, private table, private timezone) {
    this.formaters = [];
    this.colorState = {};
  }

  getColorForValue(value, style) {
    if (!style.thresholds) { return null; }

    for (var i = style.thresholds.length - 1; i >= 0 ; i--) {
      if (value >= style.thresholds[i]) {
        return style.colors[i];
      }
    }
    return null;
  }

  defaultCellFormater(v) {
    if (v === null || v === void 0) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(',&nbsp;');
    }

    return v;
  }


  createColumnFormater(style) {
    if (!style) {
      return this.defaultCellFormater;
    }

    if (style.type === 'date') {
      return v => {
        if (_.isArray(v)) { v = v[0]; }
        var date = moment(v);
        if (this.timezone === 'utc') {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      };
    }

    if (style.type === 'number') {
      let valueFormater = kbn.valueFormats[style.unit];

      return v =>  {
        if (v === null || v === void 0) {
          return '-';
        }

        if (_.isString(v)) {
          return v;
        }

        if (style.colorMode) {
          this.colorState[style.colorMode] = this.getColorForValue(v, style);
        }

        return valueFormater(v, style.decimals, null);
      };
    }

    return this.defaultCellFormater;
  }

  formatColumnValue(colIndex, value) {
    if (this.formaters[colIndex]) {
      return this.formaters[colIndex](value);
    }

    for (let i = 0; i < this.panel.columns.length; i++) {
      let style = this.panel.columns[i];
      let column = this.table.columns[colIndex];
      var regex = kbn.stringToJsRegex(style.pattern);
      if (column.text.match(regex)) {
        this.formaters[colIndex] = this.createColumnFormater(style);
        return this.formaters[colIndex](value);
      }
    }

    this.formaters[colIndex] = this.defaultCellFormater;
    return this.formaters[colIndex](value);
  }

  renderCell(columnIndex, value) {
    var value = this.formatColumnValue(columnIndex, value);
    var style = '';
    if (this.colorState.cell) {
      style = ' style="background-color:' + this.colorState.cell + ';color: white"';
      this.colorState.cell = null;
    }
    else if (this.colorState.value) {
      style = ' style="color:' + this.colorState.value + '"';
      this.colorState.value = null;
    }

    return '<td' + style + '>' + value + '</td>';
  }

  render(page) {
    let endPos = Math.min(this.panel.pageSize, this.table.rows.length);
    let startPos = 0;
    var html = "";

    for (var y = startPos; y < endPos; y++) {
      let row = this.table.rows[y];
      html += '<tr>';
      for (var i = 0; i < this.table.columns.length; i++) {
        html += this.renderCell(i, row[i]);
      }
      html += '</tr>';
    }

    return html;
  }
}
