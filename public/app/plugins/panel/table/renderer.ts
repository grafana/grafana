import _ from 'lodash';
import {
  dateTime,
  escapeStringForRegex,
  formattedValueToString,
  getColorFromHexRgbOrName,
  getValueFormat,
  GrafanaThemeType,
  ScopedVars,
  stringStartsAsRegEx,
  stringToJsRegex,
  unEscapeStringFromRegex,
} from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { ColumnRender, TableRenderModel, ColumnStyle } from './types';
import { ColumnOptionsCtrl } from './column_options';
import { sanitizeUrl, escapeHtml } from 'app/core/utils/text';

export class TableRenderer {
  formatters: any[];
  colorState: any;

  constructor(
    private panel: { styles: ColumnStyle[]; pageSize: number },
    private table: TableRenderModel,
    private isUtc: boolean,
    private sanitize: (v: any) => any,
    private templateSrv: TemplateSrv,
    private theme?: GrafanaThemeType
  ) {
    this.initColumns();
  }

  setTable(table: TableRenderModel) {
    this.table = table;

    this.initColumns();
  }

  initColumns() {
    this.formatters = [];
    this.colorState = {};

    for (let colIndex = 0; colIndex < this.table.columns.length; colIndex++) {
      const column = this.table.columns[colIndex];
      column.title = column.text;

      for (let i = 0; i < this.panel.styles.length; i++) {
        const style = this.panel.styles[i];

        const escapedPattern = stringStartsAsRegEx(style.pattern)
          ? style.pattern
          : escapeStringForRegex(unEscapeStringFromRegex(style.pattern));
        const regex = stringToJsRegex(escapedPattern);
        if (column.text.match(regex)) {
          column.style = style;

          if (style.alias) {
            column.title = escapeHtml(column.text.replace(regex, style.alias));
          }

          break;
        }
      }

      this.formatters[colIndex] = this.createColumnFormatter(column);
    }
  }

  getColorForValue(value: number, style: ColumnStyle) {
    if (!style.thresholds || !style.colors) {
      return null;
    }
    for (let i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return getColorFromHexRgbOrName(style.colors[i], this.theme);
      }
    }
    return getColorFromHexRgbOrName(_.first(style.colors), this.theme);
  }

  defaultCellFormatter(v: any, style: ColumnStyle) {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    if (style && style.sanitize) {
      return this.sanitize(v);
    } else {
      return _.escape(v);
    }
  }

  createColumnFormatter(column: ColumnRender) {
    if (!column.style) {
      return this.defaultCellFormatter;
    }

    if (column.style.type === 'hidden') {
      return (v: any): undefined => undefined;
    }

    if (column.style.type === 'date') {
      return (v: any) => {
        if (v === undefined || v === null) {
          return '-';
        }

        if (_.isArray(v)) {
          v = v[0];
        }

        // if is an epoch (numeric string and len > 12)
        if (_.isString(v) && !isNaN(v as any) && v.length > 12) {
          v = parseInt(v, 10);
        }

        let date = dateTime(v);

        if (this.isUtc) {
          date = date.utc();
        }

        return date.format(column.style.dateFormat);
      };
    }

    if (column.style.type === 'string') {
      return (v: any): any => {
        if (_.isArray(v)) {
          v = v.join(', ');
        }

        const mappingType = column.style.mappingType || 0;

        if (mappingType === 1 && column.style.valueMaps) {
          for (let i = 0; i < column.style.valueMaps.length; i++) {
            const map = column.style.valueMaps[i];

            if (v === null) {
              if (map.value === 'null') {
                return map.text;
              }
              continue;
            }

            // Allow both numeric and string values to be mapped
            if ((!_.isString(v) && Number(map.value) === Number(v)) || map.value === v) {
              this.setColorState(v, column.style);
              return this.defaultCellFormatter(map.text, column.style);
            }
          }
        }

        if (mappingType === 2 && column.style.rangeMaps) {
          for (let i = 0; i < column.style.rangeMaps.length; i++) {
            const map = column.style.rangeMaps[i];

            if (v === null) {
              if (map.from === 'null' && map.to === 'null') {
                return map.text;
              }
              continue;
            }

            if (Number(map.from) <= Number(v) && Number(map.to) >= Number(v)) {
              this.setColorState(v, column.style);
              return this.defaultCellFormatter(map.text, column.style);
            }
          }
        }

        if (v === null || v === void 0) {
          return '-';
        }

        this.setColorState(v, column.style);
        return this.defaultCellFormatter(v, column.style);
      };
    }

    if (column.style.type === 'number') {
      const valueFormatter = getValueFormat(column.unit || column.style.unit);

      return (v: any): any => {
        if (v === null || v === void 0) {
          return '-';
        }

        if (isNaN(v) || _.isArray(v)) {
          return this.defaultCellFormatter(v, column.style);
        }

        this.setColorState(v, column.style);
        return formattedValueToString(valueFormatter(v, column.style.decimals, null));
      };
    }

    return (value: any) => {
      return this.defaultCellFormatter(value, column.style);
    };
  }

  setColorState(value: any, style: ColumnStyle) {
    if (!style.colorMode) {
      return;
    }

    if (value === null || value === void 0 || _.isArray(value)) {
      return;
    }

    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      return;
    }

    this.colorState[style.colorMode] = this.getColorForValue(numericValue, style);
  }

  renderRowVariables(rowIndex: number) {
    const scopedVars: ScopedVars = {};
    let cellVariable;
    const row = this.table.rows[rowIndex];
    for (let i = 0; i < row.length; i++) {
      cellVariable = `__cell_${i}`;
      scopedVars[cellVariable] = { value: row[i], text: row[i] ? row[i].toString() : '' };
    }
    return scopedVars;
  }

  formatColumnValue(colIndex: number, value: any) {
    const fmt = this.formatters[colIndex];
    if (fmt) {
      return fmt(value);
    }
    return value;
  }

  renderCell(columnIndex: number, rowIndex: number, value: any, addWidthHack = false) {
    value = this.formatColumnValue(columnIndex, value);

    const column = this.table.columns[columnIndex];
    const cellStyles = [];
    let cellStyle = '';
    const cellClasses = [];
    let cellClass = '';

    if (this.colorState.cell) {
      cellStyles.push('background-color:' + this.colorState.cell);
      cellClasses.push('table-panel-color-cell');
      this.colorState.cell = null;
    } else if (this.colorState.value) {
      cellStyles.push('color:' + this.colorState.value);
      this.colorState.value = null;
    }
    // because of the fixed table headers css only solution
    // there is an issue if header cell is wider the cell
    // this hack adds header content to cell (not visible)
    let columnHtml = '';
    if (addWidthHack) {
      columnHtml = '<div class="table-panel-width-hack">' + this.table.columns[columnIndex].title + '</div>';
    }

    if (value === undefined) {
      cellStyles.push('display:none');
      column.hidden = true;
    } else {
      column.hidden = false;
    }

    if (column.hidden === true) {
      return '';
    }

    if (column.style && column.style.preserveFormat) {
      cellClasses.push('table-panel-cell-pre');
    }

    if (column.style && column.style.align) {
      const textAlign = _.find(ColumnOptionsCtrl.alignTypesEnum, ['text', column.style.align]);
      if (textAlign && textAlign['value']) {
        cellStyles.push(`text-align:${textAlign['value']}`);
      }
    }

    if (cellStyles.length) {
      cellStyle = ' style="' + cellStyles.join(';') + '"';
    }

    if (column.style && column.style.link) {
      // Render cell as link
      const scopedVars = this.renderRowVariables(rowIndex);
      scopedVars['__cell'] = { value: value, text: value ? value.toString() : '' };

      const cellLink = this.templateSrv.replace(column.style.linkUrl, scopedVars, encodeURIComponent);
      const sanitizedCellLink = sanitizeUrl(cellLink);

      const cellLinkTooltip = escapeHtml(this.templateSrv.replace(column.style.linkTooltip, scopedVars));
      const cellTarget = column.style.linkTargetBlank ? '_blank' : '';

      cellClasses.push('table-panel-cell-link');

      columnHtml += `<a href="${sanitizedCellLink}" target="${cellTarget}" data-link-tooltip data-original-title="${cellLinkTooltip}" data-placement="right"${cellStyle}>`;
      columnHtml += `${value}`;
      columnHtml += `</a>`;
    } else {
      columnHtml += value;
    }

    if (column.filterable) {
      cellClasses.push('table-panel-cell-filterable');
      columnHtml += `<a class="table-panel-filter-link" data-link-tooltip data-original-title="Filter out value" data-placement="bottom"
           data-row="${rowIndex}" data-column="${columnIndex}" data-operator="!=">`;
      columnHtml += `<i class="fa fa-search-minus"></i>`;
      columnHtml += `</a>`;
      columnHtml += `<a class="table-panel-filter-link" data-link-tooltip data-original-title="Filter for value" data-placement="bottom"
           data-row="${rowIndex}" data-column="${columnIndex}" data-operator="=">`;
      columnHtml += `<i class="fa fa-search-plus"></i>`;
      columnHtml += `</a>`;
    }

    if (cellClasses.length) {
      cellClass = ' class="' + cellClasses.join(' ') + '"';
    }

    columnHtml = '<td' + cellClass + cellStyle + '>' + columnHtml + '</td>';
    return columnHtml;
  }

  render(page: number) {
    const pageSize = this.panel.pageSize || 100;
    const startPos = page * pageSize;
    const endPos = Math.min(startPos + pageSize, this.table.rows.length);
    let html = '';

    for (let y = startPos; y < endPos; y++) {
      const row = this.table.rows[y];
      let cellHtml = '';
      let rowStyle = '';
      const rowClasses = [];
      let rowClass = '';
      for (let i = 0; i < this.table.columns.length; i++) {
        cellHtml += this.renderCell(i, y, row[i], y === startPos);
      }

      if (this.colorState.row) {
        rowStyle = ' style="background-color:' + this.colorState.row + '"';
        rowClasses.push('table-panel-color-row');
        this.colorState.row = null;
      }

      if (rowClasses.length) {
        rowClass = ' class="' + rowClasses.join(' ') + '"';
      }

      html += '<tr ' + rowClass + rowStyle + '>' + cellHtml + '</tr>';
    }

    return html;
  }

  render_values() {
    const rows = [];
    const visibleColumns = this.table.columns.filter(column => !column.hidden);

    for (let y = 0; y < this.table.rows.length; y++) {
      const row = this.table.rows[y];
      const newRow = [];
      for (let i = 0; i < this.table.columns.length; i++) {
        if (!this.table.columns[i].hidden) {
          newRow.push(this.formatColumnValue(i, row[i]));
        }
      }
      rows.push(newRow);
    }
    return {
      columns: visibleColumns,
      rows: rows,
    };
  }
}
