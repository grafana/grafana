// Libraries
import _ from 'lodash';
import React, { Component, CSSProperties, ReactNode } from 'react';
import {
  Table as RVTable,
  SortDirectionType,
  SortIndicator,
  Column as RVColumn,
  TableHeaderProps,
  TableCellProps,
} from 'react-virtualized';
import { Themeable } from '../../types/theme';

import { sortTableData } from '../../utils/processTimeSeries';

import moment from 'moment';

import { getValueFormat, TableData, getColorFromHexRgbOrName, InterpolateFunction, Column } from '@grafana/ui';
import { Index } from 'react-virtualized';
import { ColumnStyle } from './Table';

// APP Imports!!!
// import kbn from 'app/core/utils/kbn';

// Made to match the existing (untyped) settings in the angular table
export interface ColumnStyle {
  pattern?: string;

  alias?: string;
  colorMode?: string;
  colors?: any[];
  decimals?: number;
  thresholds?: any[];
  type?: 'date' | 'number' | 'string' | 'hidden';
  unit?: string;
  dateFormat?: string;
  sanitize?: boolean; // not used in react
  mappingType?: any;
  valueMaps?: any;
  rangeMaps?: any;

  link?: any;
  linkUrl?: any;
  linkTooltip?: any;
  linkTargetBlank?: boolean;

  preserveFormat?: boolean;
}

type CellFormatter = (v: any, style?: ColumnStyle) => ReactNode;

interface ColumnInfo {
  header: string;
  accessor: string; // the field name
  style?: ColumnStyle;
  hidden?: boolean;
  formatter: CellFormatter;
  filterable?: boolean;
}

interface Props extends Themeable {
  data?: TableData;
  showHeader: boolean;
  styles: ColumnStyle[];
  replaceVariables: InterpolateFunction;
  width: number;
  height: number;
  isUTC?: boolean;
}

interface State {
  sortBy?: number;
  sortDirection?: SortDirectionType;
  data?: TableData;
}

export class Table extends Component<Props, State> {
  columns: ColumnInfo[] = [];
  colorState: any;

  static defaultProps = {
    showHeader: true,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      data: props.data,
    };

    this.initRenderer();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { data, styles } = this.props;
    const { sortBy, sortDirection } = this.state;
    const dataChanged = data !== prevProps.data;

    // Update the renderer if options change
    if (dataChanged || styles !== prevProps.styles) {
      this.initRenderer();
    }

    // Update the data when data or sort changes
    if (dataChanged || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      const sorted = data ? sortTableData(data, sortBy, sortDirection === 'DESC') : data;
      this.setState({ data: sorted });
    }
  }

  initRenderer() {
    const { styles } = this.props;
    const { data } = this.state;
    this.colorState = {};
    if (!data || !data.columns) {
      this.columns = [];
      return;
    }
    this.columns = data.columns.map((col, index) => {
      let title = col.text;
      let style; // ColumnStyle

      // Find the style based on the text
      for (let i = 0; i < styles.length; i++) {
        const s = styles[i];
        const regex = 'XXX'; //kbn.stringToJsRegex(s.pattern);
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
        formatter: this.createColumnFormatter(col, style),
      };
    });
  }

  //----------------------------------------------------------------------
  // renderer.ts copy (taken from angular version!!!)
  //----------------------------------------------------------------------

  getColorForValue(value: any, style: ColumnStyle) {
    if (!style.thresholds || !style.colors) {
      return null;
    }
    const { theme } = this.props;

    for (let i = style.thresholds.length; i > 0; i--) {
      if (value >= style.thresholds[i - 1]) {
        return getColorFromHexRgbOrName(style.colors[i], theme.type);
      }
    }
    return getColorFromHexRgbOrName(_.first(style.colors), theme.type);
  }

  defaultCellFormatter(v: any, style?: ColumnStyle): string {
    if (v === null || v === void 0 || v === undefined) {
      return '';
    }

    if (_.isArray(v)) {
      v = v.join(', ');
    }

    return v; // react will sanitize
  }

  createColumnFormatter(schema: Column, style?: ColumnStyle): CellFormatter {
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
        if (this.props.isUTC) {
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
      const valueFormatter = getValueFormat(style.unit || schema.unit || 'none');

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

  setColorState(value: any, style: ColumnStyle) {
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

  renderRowVariables(rowIndex: number) {
    const scopedVars: any = {};
    const row = this.rowGetter({ index: rowIndex });
    for (let i = 0; i < row.length; i++) {
      scopedVars[`__cell_${i}`] = { value: row[i] };
    }
    return scopedVars;
  }

  renderCell(columnIndex: number, rowIndex: number, value: any): ReactNode {
    const column = this.columns[columnIndex];
    if (column.formatter) {
      value = column.formatter(value, column.style);
    }

    const style: CSSProperties = {};
    const cellClasses = [];
    let cellClass = '';

    if (this.colorState.cell) {
      style.backgroundColor = this.colorState.cell;
      style.color = 'white';
      this.colorState.cell = null;
    } else if (this.colorState.value) {
      style.color = this.colorState.value;
      this.colorState.value = null;
    }

    if (value === undefined) {
      style.display = 'none';
      column.hidden = true;
    } else {
      column.hidden = false;
    }

    if (column.style && column.style.preserveFormat) {
      cellClasses.push('table-panel-cell-pre');
    }

    let columnHtml: JSX.Element;
    if (column.style && column.style.link) {
      // Render cell as link
      const { replaceVariables } = this.props;
      const scopedVars = this.renderRowVariables(rowIndex);
      scopedVars['__cell'] = { value: value };

      const cellLink = replaceVariables(column.style.linkUrl, scopedVars, encodeURIComponent);
      const cellLinkTooltip = replaceVariables(column.style.linkTooltip, scopedVars);
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

    let filterLink: JSX.Element | null = null;
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

    style.width = '100%';
    style.height = '100%';
    columnHtml = (
      <div className={cellClass} style={style}>
        {columnHtml}
        {filterLink}
      </div>
    );
    return columnHtml;
  }

  //----------------------------------------------------------------------
  //----------------------------------------------------------------------

  rowGetter = ({ index }: Index) => {
    return this.state.data!.rows[index];
  };

  doSort = (info: any) => {
    let dir = info.sortDirection;
    let sort = info.sortBy;
    if (sort !== this.state.sortBy) {
      dir = 'DESC';
    } else if (dir === 'DESC') {
      dir = 'ASC';
    } else {
      sort = null;
    }
    this.setState({ sortBy: sort, sortDirection: dir });
  };

  headerRenderer = (header: TableHeaderProps): ReactNode => {
    const dataKey = header.dataKey as any; // types say string, but it is number!
    const { data, sortBy, sortDirection } = this.state;
    const col = data!.columns[dataKey];

    return (
      <div>
        {col.text} {sortBy === dataKey && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  cellRenderer = (cell: TableCellProps) => {
    const { columnIndex, rowIndex } = cell;
    const row = this.state.data!.rows[rowIndex];
    const val = row[columnIndex];
    return this.renderCell(columnIndex, rowIndex, val);
  };

  render() {
    const { width, height, showHeader } = this.props;
    const { data } = this.props;
    if (!data) {
      return <div>NO Data</div>;
    }

    return (
      <RVTable
        disableHeader={!showHeader}
        headerHeight={30}
        height={height}
        overscanRowCount={10}
        rowHeight={30}
        rowGetter={this.rowGetter}
        rowCount={data.rows.length}
        sort={this.doSort}
        width={width}
      >
        {data.columns.map((col, index) => {
          return (
            <RVColumn
              key={index}
              dataKey={index}
              headerRenderer={this.headerRenderer}
              cellRenderer={this.cellRenderer}
              width={150}
              minWidth={50}
              flexGrow={1}
            />
          );
        })}
      </RVTable>
    );
  }
}

export default Table;
