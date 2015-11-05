///<reference path="../../headers/common.d.ts" />

import _ = require('lodash');
import kbn = require('app/core/utils/kbn');
import moment = require('moment');

export class TableRenderer {
  formaters: any[];

  constructor(private panel, private table, private timezone) {
    this.formaters = [];
  }

  createColumnFormater(style) {
    return (v) => {
      if (v === null || v === void 0) {
        return '-';
      }
      if (_.isString(v) || !style) {
        return v;
      }

      if (style.type === 'date') {
        if (_.isArray(v)) { v = v[0]; }
        var date = moment(v);
        if (this.timezone === 'utc') {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      }

      if (_.isNumber(v) && style.type === 'number') {
        let valueFormater = kbn.valueFormats[style.unit];
        return valueFormater(v, style.decimals);
      }

      if (_.isArray(v)) {
        v = v.join(',&nbsp;');
      }

      return v;
    };
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

    this.formaters[colIndex] = function(v) {
      return v;
    };

    return this.formaters[colIndex](value);
  }

  renderCell(columnIndex, value) {
    var colValue = this.formatColumnValue(columnIndex, value);
    return '<td>' + colValue + '</td>';
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
