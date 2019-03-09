// Libraries
import _ from 'lodash';
import React, { Component, ReactNode } from 'react';
import {
  SortDirectionType,
  SortIndicator,
  MultiGrid,
  CellMeasurerCache,
  CellMeasurer,
  GridCellProps,
} from 'react-virtualized';
import { Themeable } from '../../types/theme';

import { sortTableData } from '../../utils/processTimeSeries';

import { TableData, InterpolateFunction } from '@grafana/ui';
import { ColumnStyle } from './Table';

// APP Imports!!!
// import kbn from 'app/core/utils/kbn';

// Made to match the existing (untyped) settings in the angular table
export interface ColumnStyle {
  pattern?: string;

  alias?: string;
  colorMode?: 'cell' | 'value';
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
  fixedColumnCount: number;
  fixedRowCount: number;
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

  _cache: CellMeasurerCache;

  static defaultProps = {
    showHeader: true,
    fixedRowCount: 1,
    fixedColumnCount: 0,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      data: props.data,
    };

    this._cache = new CellMeasurerCache({
      defaultHeight: 30,
      defaultWidth: 150,
    });

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

  initRenderer() {}

  //----------------------------------------------------------------------
  //----------------------------------------------------------------------

  doSort = (columnIndex: number) => {
    let sort: any = this.state.sortBy;
    let dir = this.state.sortDirection;
    if (sort !== columnIndex) {
      dir = 'DESC';
      sort = columnIndex;
    } else if (dir === 'DESC') {
      dir = 'ASC';
    } else {
      sort = null;
    }
    this.setState({ sortBy: sort, sortDirection: dir });
  };

  handelClick = (rowIndex: number, columnIndex: number) => {
    const { showHeader } = this.props;
    const { data } = this.state;
    const realRowIndex = rowIndex - (showHeader ? 1 : 0);
    if (realRowIndex < 0) {
      this.doSort(columnIndex);
    } else {
      const row = data!.rows[realRowIndex];
      const value = row[columnIndex];
      console.log('CLICK', rowIndex, columnIndex, value);
    }
  };

  headerRenderer = (columnIndex: number): ReactNode => {
    const { data, sortBy, sortDirection } = this.state;
    const col = data!.columns[columnIndex];
    const sorting = sortBy === columnIndex;

    return (
      <div>
        {col.text}{' '}
        {sorting && (
          <span>
            {sortDirection}
            <SortIndicator sortDirection={sortDirection} />
          </span>
        )}
      </div>
    );
  };

  cellRenderer = (props: GridCellProps): React.ReactNode => {
    const { rowIndex, columnIndex, key, parent, style } = props;
    const { showHeader } = this.props;
    const { data } = this.state;
    if (!data) {
      return <div>?</div>;
    }

    const realRowIndex = rowIndex - (showHeader ? 1 : 0);

    let classNames = 'gf-table-cell';
    let content = null;

    if (realRowIndex < 0) {
      content = this.headerRenderer(columnIndex);
      classNames = 'gf-table-header';
    } else {
      const row = data.rows[realRowIndex];
      const value = row[columnIndex];
      content = (
        <div>
          {rowIndex}/{columnIndex}: {value}
        </div>
      );
    }

    return (
      <CellMeasurer cache={this._cache} columnIndex={columnIndex} key={key} parent={parent} rowIndex={rowIndex}>
        <div
          onClick={() => this.handelClick(rowIndex, columnIndex)}
          className={classNames}
          style={{
            ...style,
            whiteSpace: 'nowrap',
          }}
        >
          {content}
        </div>
      </CellMeasurer>
    );
  };

  render() {
    const { data, showHeader, width, height, fixedColumnCount, fixedRowCount } = this.props;
    if (!data) {
      return <div>NO Data</div>;
    }

    return (
      <MultiGrid
        {
          ...this.state /** Force MultiGrid to update when any property updates */
        }
        columnCount={data.columns.length}
        rowCount={data.rows.length + (showHeader ? 1 : 0)}
        overscanColumnCount={2}
        overscanRowCount={2}
        columnWidth={this._cache.columnWidth}
        deferredMeasurementCache={this._cache}
        cellRenderer={this.cellRenderer}
        rowHeight={this._cache.rowHeight}
        width={width}
        height={height}
        fixedColumnCount={fixedColumnCount}
        fixedRowCount={fixedRowCount}
        classNameTopLeftGrid="gf-table-fixed-row-and-column"
        classNameTopRightGrid="gf-table-fixed-row"
        classNameBottomLeftGrid="gf-table-fixed-column"
        classNameBottomRightGrid="gf-table-normal-cell"
      />
    );
  }
}

export default Table;
