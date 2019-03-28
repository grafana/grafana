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
  Index,
} from 'react-virtualized';
import { Themeable } from '../../types/theme';

import { sortSeriesData } from '../../utils/processSeriesData';

import { SeriesData, InterpolateFunction } from '@grafana/ui';
import {
  TableCellBuilder,
  ColumnStyle,
  getCellBuilder,
  TableCellBuilderOptions,
  simpleCellBuilder,
} from './TableCellBuilder';
import { stringToJsRegex } from '../../utils/index';

export interface Props extends Themeable {
  data: SeriesData;

  minColumnWidth: number;
  showHeader: boolean;
  fixedHeader: boolean;
  fixedColumns: number;
  rotate: boolean;
  styles: ColumnStyle[];

  replaceVariables: InterpolateFunction;
  width: number;
  height: number;
  isUTC?: boolean;
}

interface State {
  sortBy?: number;
  sortDirection?: SortDirectionType;
  data: SeriesData;
}

interface ColumnRenderInfo {
  header: string;
  width: number;
  builder: TableCellBuilder;
}

interface DataIndex {
  column: number;
  row: number; // -1 is the header!
}

export class Table extends Component<Props, State> {
  renderer: ColumnRenderInfo[];
  measurer: CellMeasurerCache;
  scrollToTop = false;

  static defaultProps = {
    showHeader: true,
    fixedHeader: true,
    fixedColumns: 0,
    rotate: false,
    minColumnWidth: 150,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      data: props.data,
    };

    this.renderer = this.initColumns(props);
    this.measurer = new CellMeasurerCache({
      defaultHeight: 30,
      fixedWidth: true,
    });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { data, styles, showHeader } = this.props;
    const { sortBy, sortDirection } = this.state;
    const dataChanged = data !== prevProps.data;
    const configsChanged =
      showHeader !== prevProps.showHeader ||
      this.props.rotate !== prevProps.rotate ||
      this.props.fixedColumns !== prevProps.fixedColumns ||
      this.props.fixedHeader !== prevProps.fixedHeader;

    // Reset the size cache
    if (dataChanged || configsChanged) {
      this.measurer.clearAll();
    }

    // Update the renderer if options change
    // We only *need* do to this if the header values changes, but this does every data update
    if (dataChanged || styles !== prevProps.styles) {
      this.renderer = this.initColumns(this.props);
    }

    // Update the data when data or sort changes
    if (dataChanged || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      this.scrollToTop = true;
      this.setState({ data: sortSeriesData(data, sortBy, sortDirection === 'DESC') });
    }
  }

  /** Given the configuration, setup how each column gets rendered */
  initColumns(props: Props): ColumnRenderInfo[] {
    const { styles, data, width, minColumnWidth } = props;
    const columnWidth = Math.max(width / data.fields.length, minColumnWidth);

    return data.fields.map((col, index) => {
      let title = col.name;
      let style: ColumnStyle | null = null; // ColumnStyle

      // Find the style based on the text
      for (let i = 0; i < styles.length; i++) {
        const s = styles[i];
        const regex = stringToJsRegex(s.pattern);
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
        width: columnWidth,
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

  /** Converts the grid coordinates to SeriesData coordinates */
  getCellRef = (rowIndex: number, columnIndex: number): DataIndex => {
    const { showHeader, rotate } = this.props;
    const rowOffset = showHeader ? -1 : 0;

    if (rotate) {
      return { column: rowIndex, row: columnIndex + rowOffset };
    } else {
      return { column: columnIndex, row: rowIndex + rowOffset };
    }
  };

  onCellClick = (rowIndex: number, columnIndex: number) => {
    const { row, column } = this.getCellRef(rowIndex, columnIndex);
    if (row < 0) {
      this.doSort(column);
    } else {
      const values = this.state.data.rows[row];
      const value = values[column];
      console.log('CLICK', value, row);
    }
  };

  headerBuilder = (cell: TableCellBuilderOptions): ReactElement<'div'> => {
    const { data, sortBy, sortDirection } = this.state;
    const { columnIndex, rowIndex, style } = cell.props;
    const { column } = this.getCellRef(rowIndex, columnIndex);

    let col = data.fields[column];
    const sorting = sortBy === column;
    if (!col) {
      col = {
        name: '??' + columnIndex + '???',
      };
    }

    return (
      <div className="gf-table-header" style={style} onClick={() => this.onCellClick(rowIndex, columnIndex)}>
        {col.name}
        {sorting && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  getTableCellBuilder = (column: number): TableCellBuilder => {
    const render = this.renderer[column];
    if (render && render.builder) {
      return render.builder;
    }
    return simpleCellBuilder; // the default
  };

  cellRenderer = (props: GridCellProps): React.ReactNode => {
    const { rowIndex, columnIndex, key, parent } = props;
    const { row, column } = this.getCellRef(rowIndex, columnIndex);
    const { data } = this.state;

    const isHeader = row < 0;
    const rowData = isHeader ? data.fields : data.rows[row];
    const value = rowData ? rowData[column] : '';
    const builder = isHeader ? this.headerBuilder : this.getTableCellBuilder(column);

    return (
      <CellMeasurer cache={this.measurer} columnIndex={columnIndex} key={key} parent={parent} rowIndex={rowIndex}>
        {builder({
          value,
          row: rowData,
          column: data.fields[column],
          table: this,
          props,
        })}
      </CellMeasurer>
    );
  };

  getColumnWidth = (col: Index): number => {
    return this.renderer[col.index].width;
  };

  render() {
    const { showHeader, fixedHeader, fixedColumns, rotate, width, height } = this.props;
    const { data } = this.state;

    let columnCount = data.fields.length;
    let rowCount = data.rows.length + (showHeader ? 1 : 0);

    let fixedColumnCount = Math.min(fixedColumns, columnCount);
    let fixedRowCount = showHeader && fixedHeader ? 1 : 0;

    if (rotate) {
      const temp = columnCount;
      columnCount = rowCount;
      rowCount = temp;

      fixedRowCount = 0;
      fixedColumnCount = Math.min(fixedColumns, rowCount) + (showHeader && fixedHeader ? 1 : 0);
    }

    // Called after sort or the data changes
    const scroll = this.scrollToTop ? 1 : -1;
    const scrollToRow = rotate ? -1 : scroll;
    const scrollToColumn = rotate ? scroll : -1;
    if (this.scrollToTop) {
      this.scrollToTop = false;
    }

    return (
      <MultiGrid
        {
          ...this.state /** Force MultiGrid to update when data changes */
        }
        {
          ...this.props /** Force MultiGrid to update when data changes */
        }
        scrollToRow={scrollToRow}
        columnCount={columnCount}
        scrollToColumn={scrollToColumn}
        rowCount={rowCount}
        overscanColumnCount={8}
        overscanRowCount={8}
        columnWidth={this.getColumnWidth}
        deferredMeasurementCache={this.measurer}
        cellRenderer={this.cellRenderer}
        rowHeight={this.measurer.rowHeight}
        width={width}
        height={height}
        fixedColumnCount={fixedColumnCount}
        fixedRowCount={fixedRowCount}
        classNameTopLeftGrid="gf-table-fixed-column"
        classNameBottomLeftGrid="gf-table-fixed-column"
      />
    );
  }
}

export default Table;
