///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';

export class TableRenderer {
  formaters: any[];
  colorState: any;

  constructor(private panel, private table, private isUtc) {
    this.formaters = [];
    this.colorState = {};
  }

  getColorForValue(value, style) {
    if (!style.thresholds) { return null; }

    for (var i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return style.colors[i];
      }
    }
    return _.first(style.colors);
  }

  defaultCellFormater(v, style) {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    return v;
  }

  createColumnFormater(style, column) {
    if (!style) {
      return this.defaultCellFormater;
    }

    if (style.type === 'date') {
      return v => {
        if (_.isArray(v)) { v = v[0]; }
        var date = moment(v);
        if (this.isUtc) {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      };
    }

    if (style.type === 'number') {
      let valueFormater = kbn.valueFormats[column.unit || style.unit];

      return v =>  {
        if (v === null || v === void 0) {
          return '-';
        }

        if (_.isString(v)) {
          return this.defaultCellFormater(v, style);
        }

        if (style.colorMode) {
          this.colorState[style.colorMode] = this.getColorForValue(v, style);
        }

        return valueFormater(v, style.decimals, null);
      };
    }

    return (value) => {
      return this.defaultCellFormater(value, style);
    };
  }

  formatColumnValue(colIndex, value) {
    if (this.formaters[colIndex]) {
      return this.formaters[colIndex](value);
    }

    for (let i = 0; i < this.panel.styles.length; i++) {
      let style = this.panel.styles[i];
      let column = this.table.columns[colIndex];
      var regex = kbn.stringToJsRegex(style.pattern);
      if (column.text.match(regex)) {
        this.formaters[colIndex] = this.createColumnFormater(style, column);
        return this.formaters[colIndex](value);
      }
    }

    this.formaters[colIndex] = this.defaultCellFormater;
    return this.formaters[colIndex](value);
  }

  renderCell(columnIndex, value, addWidthHack = false, rowLink = '') {
    value = this.formatColumnValue(columnIndex, value);
    var style = '';

    if (rowLink !== '') {
      value = '<a href="' + rowLink + '" target="_new">' + value + '</a>';
    }

    if (this.colorState.cell) {
      style = ' style="background-color:' + this.colorState.cell + ';color: white"';
      this.colorState.cell = null;
    } else if (this.colorState.value) {
      style = ' style="color:' + this.colorState.value + '"';
      this.colorState.value = null;
    }

    // because of the fixed table headers css only solution
    // there is an issue if header cell is wider the cell
    // this hack adds header content to cell (not visible)
    var widthHack = '';
    if (addWidthHack) {
      widthHack = '<div class="table-panel-width-hack">' + this.table.columns[columnIndex].text + '</div>';
    }

    return '<td' + style + '>' + value + widthHack + '</td>';
  }

  render(page) {
    let pageSize = this.panel.pageSize || 100;
    let startPos = page * pageSize;
    let endPos = Math.min(startPos + pageSize, this.table.rows.length);
    let rowLink = this.panel.rowLink;
    var html = "";

    for (var y = startPos; y < endPos; y++) {
      let row = this.table.rows[y];
      let cellHtml = '';
      let rowStyle = '';

      if (rowLink) {
        for (var i = 0; i < this.table.columns.length; i++) {
          rowLink = rowLink.replace('$' + this.table.columns[i].text, _.escape(row[i]));
        }
      }

      for (var i = 0; i < this.table.columns.length; i++) {
        cellHtml += this.renderCell(i, row[i], y === startPos, rowLink);
      }

      if (this.colorState.row) {
        rowStyle = ' style="background-color:' + this.colorState.row + ';color: white"';
        this.colorState.row = null;
      }

      html += '<tr ' + rowStyle + '>' + cellHtml + '</tr>';
    }

    return html;
  }

  render_values() {
    let rows = [];

    for (var y = 0; y < this.table.rows.length; y++) {
      let row = this.table.rows[y];
      let new_row = [];
      for (var i = 0; i < this.table.columns.length; i++) {
        new_row.push(this.formatColumnValue(i, row[i]));
      }
      rows.push(new_row);
    }
    return {
        columns: this.table.columns,
        rows: rows,
    };
  }
}
