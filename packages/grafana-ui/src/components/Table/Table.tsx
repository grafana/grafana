// Libraries
import _ from 'lodash';
import React, { Component, ReactElement } from 'react';
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
import { TableCellBuilder, ColumnStyle, getCellBuilder, TableCellBuilderOptions } from './TableCellBuilder';

interface ColumnInfo {
  index: number;
  header: string;
  builder: TableCellBuilder;
}

export interface Props extends Themeable {
  data: TableData;
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
  data: TableData;
}

export class Table extends Component<Props, State> {
  columns: ColumnInfo[];
  measurer: CellMeasurerCache;

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

    this.columns = this.initColumns(props);
    this.measurer = new CellMeasurerCache({
      defaultHeight: 30,
      defaultWidth: 150,
    });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { data, styles } = this.props;
    const { sortBy, sortDirection } = this.state;
    const dataChanged = data !== prevProps.data;

    // Reset the size cache
    if (dataChanged) {
      this.measurer.clearAll();
    }

    // Update the renderer if options change
    if (dataChanged || styles !== prevProps.styles) {
      this.columns = this.initColumns(this.props);
    }

    // Update the data when data or sort changes
    if (dataChanged || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      const sorted = data ? sortTableData(data, sortBy, sortDirection === 'DESC') : data;
      this.setState({ data: sorted });
    }
  }

  initColumns(props: Props): ColumnInfo[] {
    const { styles, data } = props;
    return data.columns.map((col, index) => {
      let title = col.text;
      let style: ColumnStyle | null = null; // ColumnStyle

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
        index,
        header: title,
        builder: getCellBuilder(col, style, this.props),
      };
    });
  }

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

  handleCellClick = (rowIndex: number, columnIndex: number) => {
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

  headerBuilder = (cell: TableCellBuilderOptions): ReactElement<'div'> => {
    const { data, sortBy, sortDirection } = this.state;
    const { columnIndex, rowIndex, style } = cell.props;

    const col = data!.columns[columnIndex];
    const sorting = sortBy === columnIndex;

    return (
      <div className="gf-table-header" style={style} onClick={() => this.handleCellClick(rowIndex, columnIndex)}>
        {col.text}
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
    const { rowIndex, columnIndex, key, parent } = props;
    const { showHeader } = this.props;
    const { data } = this.state;
    if (!data) {
      return <div>??</div>;
    }

    const realRowIndex = rowIndex - (showHeader ? 1 : 0);
    const isHeader = realRowIndex < 0;
    const row = isHeader ? (data.columns as any[]) : data.rows[realRowIndex];
    const value = row[columnIndex];
    const builder = isHeader ? this.headerBuilder : this.columns[columnIndex].builder;

    return (
      <CellMeasurer cache={this.measurer} columnIndex={columnIndex} key={key} parent={parent} rowIndex={rowIndex}>
        {builder({ value, row, table: this, props })}
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
          ...this.state /** Force MultiGrid to update when data changes */
        }
        columnCount={data.columns.length}
        rowCount={data.rows.length + (showHeader ? 1 : 0)}
        overscanColumnCount={2}
        overscanRowCount={2}
        columnWidth={this.measurer.columnWidth}
        deferredMeasurementCache={this.measurer}
        cellRenderer={this.cellRenderer}
        rowHeight={this.measurer.rowHeight}
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
