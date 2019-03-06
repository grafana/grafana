// Libraries
import _ from 'lodash';
import moment from 'moment';
import React, { PureComponent } from 'react';

import ReactTable from 'react-table';

import { sanitize } from 'app/core/utils/text';

// Types
import { PanelProps } from '@grafana/ui/src/types';
import { Options, Style, Column, CellFormatter } from './types';
import kbn from 'app/core/utils/kbn';

import templateSrv from 'app/features/templating/template_srv';

interface Props extends PanelProps<Options> {}

export class TablePanel extends PureComponent<Props> {
  isUTC: false; // TODO? get UTC from props?

  columns: Column[];
  colorState: any;

  initColumns() {
    this.colorState = {};

    const { panelData, options } = this.props;
    if (!panelData.tableData) {
      this.columns = [];
      return;
    }
    const { styles } = options;

    this.columns = panelData.tableData.columns.map((col, index) => {
      let title = col.text;
      let style: Style = null;

      for (let i = 0; i < styles.length; i++) {
        const s = styles[i];
        const regex = kbn.stringToJsRegex(s.pattern);
        if (title.match(regex)) {
          style = s;
          if (s.alias) {
            title = title.replace(regex, s.alias);
          }
          break;
        }
      }

      return {
        header: title,
        accessor: col.text, // unique?
        style: style,
        formatter: this.createColumnFormatter(style, col),
      };
    });
  }

  getColorForValue(value: any, style: Style) {
    if (!style.thresholds) {
      return null;
    }
    for (let i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return style.colors[i];
      }
    }
    return _.first(style.colors);
  }

  defaultCellFormatter(v: any, style: Style): string {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    if (style && style.sanitize) {
      return sanitize(v);
    } else {
      return _.escape(v);
    }
  }

  createColumnFormatter(style: Style, header: any): CellFormatter {
    if (!style) {
      return this.defaultCellFormatter;
    }

    if (style.type === 'hidden') {
      return v => {
        return undefined;
      };
    }

    if (style.type === 'date') {
      return v => {
        if (v === undefined || v === null) {
          return '-';
        }

        if (_.isArray(v)) {
          v = v[0];
        }
        let date = moment(v);
        if (this.isUTC) {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      };
    }

    if (style.type === 'string') {
      return v => {
        if (_.isArray(v)) {
          v = v.join(', ');
        }

        const mappingType = style.mappingType || 0;

        if (mappingType === 1 && style.valueMaps) {
          for (let i = 0; i < style.valueMaps.length; i++) {
            const map = style.valueMaps[i];

            if (v === null) {
              if (map.value === 'null') {
                return map.text;
              }
              continue;
            }

            // Allow both numeric and string values to be mapped
            if ((!_.isString(v) && Number(map.value) === Number(v)) || map.value === v) {
              this.setColorState(v, style);
              return this.defaultCellFormatter(map.text, style);
            }
          }
        }

        if (mappingType === 2 && style.rangeMaps) {
          for (let i = 0; i < style.rangeMaps.length; i++) {
            const map = style.rangeMaps[i];

            if (v === null) {
              if (map.from === 'null' && map.to === 'null') {
                return map.text;
              }
              continue;
            }

            if (Number(map.from) <= Number(v) && Number(map.to) >= Number(v)) {
              this.setColorState(v, style);
              return this.defaultCellFormatter(map.text, style);
            }
          }
        }

        if (v === null || v === void 0) {
          return '-';
        }

        this.setColorState(v, style);
        return this.defaultCellFormatter(v, style);
      };
    }

    if (style.type === 'number') {
      const valueFormatter = kbn.valueFormats[style.unit || header.unit];

      return v => {
        if (v === null || v === void 0) {
          return '-';
        }

        if (_.isString(v) || _.isArray(v)) {
          return this.defaultCellFormatter(v, style);
        }

        this.setColorState(v, style);
        return valueFormatter(v, style.decimals, null);
      };
    }

    return value => {
      return this.defaultCellFormatter(value, style);
    };
  }

  setColorState(value: any, style: Style) {
    if (!style.colorMode) {
      return;
    }

    if (value === null || value === void 0 || _.isArray(value)) {
      return;
    }

    if (_.isNaN(value)) {
      return;
    }
    const numericValue = Number(value);
    this.colorState[style.colorMode] = this.getColorForValue(numericValue, style);
  }

  renderRowVariables(rowIndex) {
    const { panelData } = this.props;

    const scopedVars = {};
    const row = panelData.tableData.rows[rowIndex];
    for (let i = 0; i < row.length; i++) {
      scopedVars[`__cell_${i}`] = { value: row[i] };
    }
    return scopedVars;
  }

  renderCell(columnIndex: number, rowIndex: number, value: any, addWidthHack = false) {
    const column = this.columns[columnIndex];
    if (column.formatter) {
      value = column.formatter(value, column.style);
    }

    const style = {};
    const cellClasses = [];
    let cellClass = '';

    if (this.colorState.cell) {
      style['backgroundColor'] = this.colorState.cell;
      style['color'] = 'white';
      this.colorState.cell = null;
    } else if (this.colorState.value) {
      style['color'] = this.colorState.value;
      this.colorState.value = null;
    }

    if (value === undefined) {
      style['display'] = 'none';
      column.hidden = true;
    } else {
      column.hidden = false;
    }

    if (column.style && column.style.preserveFormat) {
      cellClasses.push('table-panel-cell-pre');
    }

    let columnHtml;
    if (column.style && column.style.link) {
      // Render cell as link
      const scopedconsts = this.renderRowVariables(rowIndex);
      scopedconsts['__cell'] = { value: value };

      const cellLink = templateSrv.replace(column.style.linkUrl, scopedconsts, encodeURIComponent);
      const cellLinkTooltip = templateSrv.replace(column.style.linkTooltip, scopedconsts);
      const cellTarget = column.style.linkTargetBlank ? '_blank' : '';

      cellClasses.push('table-panel-cell-link');
      columnHtml = (
        <a
          href={cellLink}
          target={cellTarget}
          data-link-tooltip
          data-original-title={cellLinkTooltip}
          data-placement="right"
        >
          {value}
        </a>
      );
    } else {
      columnHtml = <span>{value}</span>;
    }

    let filterLink;
    if (column.filterable) {
      cellClasses.push('table-panel-cell-filterable');
      filterLink = (
        <span>
          <a
            className="table-panel-filter-link"
            data-link-tooltip
            data-original-title="Filter out value"
            data-placement="bottom"
            data-row={rowIndex}
            data-column={columnIndex}
            data-operator="!="
          >
            <i className="fa fa-search-minus" />
          </a>
          <a
            className="table-panel-filter-link"
            data-link-tooltip
            data-original-title="Filter for value"
            data-placement="bottom"
            data-row={rowIndex}
            data-column={columnIndex}
            data-operator="="
          >
            <i className="fa fa-search-plus" />
          </a>
        </span>
      );
    }

    if (cellClasses.length) {
      cellClass = cellClasses.join(' ');
    }

    style['width'] = '100%';
    style['height'] = '100%';
    columnHtml = (
      <div className={cellClass} style={style}>
        {columnHtml}
        {filterLink}
      </div>
    );
    return columnHtml;
  }

  render() {
    const { panelData, height, options } = this.props;
    const { pageSize } = options;

    let rows = [];
    let columns = [];
    if (panelData.tableData) {
      this.initColumns();
      const fields = this.columns.map(c => {
        return c.accessor;
      });
      rows = panelData.tableData.rows.map(row => {
        return _.zipObject(fields, row);
      });
      columns = this.columns.map((c, columnIndex) => {
        return {
          Header: c.header,
          accessor: c.accessor,
          filterable: !!c.filterable,
          Cell: row => {
            return this.renderCell(columnIndex, row.index, row.value);
          },
        };
      });
      console.log(templateSrv);
      console.log(rows);
    } else {
      return <div>No Table Data...</div>;
    }

    // Only show paging if necessary
    const showPaginationBottom = pageSize && pageSize < panelData.tableData.rows.length;

    return (
      <ReactTable
        data={rows}
        columns={columns}
        defaultPageSize={pageSize}
        style={{
          height: height - 20 + 'px',
        }}
        showPaginationBottom={showPaginationBottom}
        getTdProps={(state, rowInfo, column, instance) => {
          return {
            onClick: (e, handleOriginal) => {
              console.log('filter', rowInfo.row[column.id]);
              if (handleOriginal) {
                handleOriginal();
              }
            },
          };
        }}
      />
    );
  }
}
