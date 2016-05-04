///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';

export class TableRenderer {
  formaters: any[];
  colorState: any;
  alignState: any;

  constructor(private panel, private table, private isUtc) {
    this.formaters = [];
    this.colorState = {};
    this.alignState = '';
  }

  getColorForValue(value, style) {
    if (!style.thresholds) { return null; }

    for (var i = style.thresholds.length; i--;) {
      if (value >= style.thresholds[i]) {
        return style.colors[i];
      }
    }
    return _.first(style.colors);
  }

  defaultCellFormater(v) {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    return v;
  }

  createColumnFormater(style) {
    if (!style) {
      return this.defaultCellFormater;
    }

    if (style.type === 'hidden') {
      return v => {
        return undefined;
      };
    }

    if (style.type === 'string') {
      return v => {
        this.alignState = style.align;
        return this.defaultCellFormater(v);
      };
    }

    if (style.type === 'date') {
      return v => {
        if (_.isArray(v)) { v = v[0]; }
        var date = moment(v);
        if (this.isUtc) {
          date = date.utc();
        }
        this.alignState = style.align;
        return date.format(style.dateFormat);
      };
    }

    if (style.type === 'number') {
      let valueFormater = kbn.valueFormats[style.unit];

      return v =>  {
        this.alignState = style.align;

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

    for (let i = 0; i < this.panel.styles.length; i++) {
      let style = this.panel.styles[i];
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

  renderCell(columnIndex, value, addWidthHack = false, rowLink = '') {
    value = this.formatColumnValue(columnIndex, value);

    if (value !== undefined) {
      value = _.escape(value);
    }

    var style = '';
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

    if (value === undefined) {
      style = ' style="display:none;"';
      this.table.columns[columnIndex].hidden = true;
    } else {
      this.table.columns[columnIndex].hidden = false;
      if (rowLink !== '') {
        value = '<a href="' + rowLink + '" target="_new">' + value + '</a>';
      }
    }

    return '<td' + style + ' align="' + this.alignState + '">' + value + widthHack + '</td>';
  }

  render(page) {
    let pageSize = this.panel.pageSize || 100;
    let startPos = page * pageSize;
    let endPos = Math.min(startPos + pageSize, this.table.rows.length);
    var html = "";

    for (var y = startPos; y < endPos; y++) {
      let row = this.table.rows[y];
      let cellHtml = '';
      let rowStyle = '';
      let rowLink = this.panel.rowLink;

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
}
