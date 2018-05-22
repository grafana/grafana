import _ from 'lodash';
import moment from 'moment';
import React from 'react';
import ReactTable from 'react-table';
import { react2AngularDirective } from 'app/core/utils/react2angular';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';

export interface IProps {
  data: any;
  panelStyles: any;
  pageSize: number;
  height: number;
  utc: boolean;
  sanitize: any;
}

export class Table extends React.Component<IProps, any> {
  formatters: any[];
  colorState: any;

  constructor(props) {
    super(props);
  }

  initColumns() {
    this.formatters = [];
    this.colorState = {};

    for (let colIndex = 0; colIndex < this.props.data.columns.length; colIndex++) {
      let column = this.props.data.columns[colIndex];
      column.title = column.text;

      for (let i = 0; i < this.props.panelStyles.length; i++) {
        let style = this.props.panelStyles[i];

        var regex = kbn.stringToJsRegex(style.pattern);
        if (column.text.match(regex)) {
          column.style = style;

          if (style.alias) {
            column.title = column.text.replace(regex, style.alias);
          }

          break;
        }
      }

      this.formatters[colIndex] = this.createColumnFormatter(column);
    }
  }

  getColorForValue(value, style) {
    if (!style.thresholds) {
      return null;
    }
    for (var i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return style.colors[i];
      }
    }
    return _.first(style.colors);
  }

  defaultCellFormatter(v, style) {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    if (style && style.sanitize) {
      return this.props.sanitize(v);
    } else {
      return _.escape(v);
    }
  }

  createColumnFormatter(column) {
    if (!column.style) {
      return this.defaultCellFormatter;
    }

    if (column.style.type === 'hidden') {
      return v => {
        return undefined;
      };
    }

    if (column.style.type === 'date') {
      return v => {
        if (v === undefined || v === null) {
          return '-';
        }

        if (_.isArray(v)) {
          v = v[0];
        }
        var date = moment(v);
        if (this.props.utc) {
          date = date.utc();
        }
        return date.format(column.style.dateFormat);
      };
    }

    if (column.style.type === 'string') {
      return v => {
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
      let valueFormatter = kbn.valueFormats[column.unit || column.style.unit];

      return v => {
        if (v === null || v === void 0) {
          return '-';
        }

        if (_.isString(v) || _.isArray(v)) {
          return this.defaultCellFormatter(v, column.style);
        }

        this.setColorState(v, column.style);
        return valueFormatter(v, column.style.decimals, null);
      };
    }

    return value => {
      return this.defaultCellFormatter(value, column.style);
    };
  }

  setColorState(value, style) {
    if (!style.colorMode) {
      return;
    }

    if (value === null || value === void 0 || _.isArray(value)) {
      return;
    }

    var numericValue = Number(value);
    if (numericValue === NaN) {
      return;
    }

    this.colorState[style.colorMode] = this.getColorForValue(numericValue, style);
  }

  renderRowVariables(rowIndex) {
    let scopedVars = {};
    let cell_variable;
    let row = this.props.data.rows[rowIndex];
    for (let i = 0; i < row.length; i++) {
      cell_variable = `__cell_${i}`;
      scopedVars[cell_variable] = { value: row[i] };
    }
    return scopedVars;
  }

  formatColumnValue(colIndex, value) {
    return this.formatters[colIndex] ? _.bind(this.formatters[colIndex], this)(value) : value;
  }

  renderCell(columnIndex, rowIndex, value, addWidthHack = false) {
    value = this.formatColumnValue(columnIndex, value);

    var column = this.props.data.columns[columnIndex];
    var style = {};
    var cellClasses = [];
    var cellClass = '';

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
      var scopedVars = this.renderRowVariables(rowIndex);
      scopedVars['__cell'] = { value: value };

      var cellLink = templateSrv.replace(column.style.linkUrl, scopedVars, encodeURIComponent);
      var cellLinkTooltip = templateSrv.replace(column.style.linkTooltip, scopedVars);
      var cellTarget = column.style.linkTargetBlank ? '_blank' : '';

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
    let rows = [];
    let columns = [];
    if (this.props.data) {
      this.initColumns();
      let columnNames = this.props.data.columns.map(c => {
        return c.text;
      });
      rows = this.props.data.rows.map(row => {
        return _.zipObject(columnNames, row);
      });
      columns = this.props.data.columns.map((c, columnIndex) => {
        return {
          Header: c.text,
          accessor: c.text,
          filterable: !!c.filterble,
          Cell: row => {
            return this.renderCell(columnIndex, row.index, row.value);
          },
        };
      });
      console.log(templateSrv);
      console.log(rows);
    }
    let pageSize = this.props.pageSize || 100;
    return (
      <ReactTable
        data={rows}
        columns={columns}
        defaultPageSize={pageSize}
        style={{
          height: this.props.height - 20 + 'px',
        }}
        showPaginationBottom
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

react2AngularDirective('reactTable', Table, ['data', 'panelStyles', 'pageSize', 'height', 'utc', 'sanitize']);
