// Libraries
import React, { Component, ReactNode } from 'react';
import {
  Table,
  SortDirectionType,
  SortIndicator,
  Column,
  TableHeaderProps,
  TableCellProps,
  Index,
} from 'react-virtualized';
import { Themeable } from '../../types/theme';

import { sortTableData } from '../../utils/processTimeSeries';

// Types
import { TableData, InterpolateFunction } from '../../types/index';
import { TableRenderer } from './renderer';

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
  sanitize?: boolean;
  mappingType?: any;
  valueMaps?: any;
  rangeMaps?: any;

  link?: any;
  linkUrl?: any;
  linkTooltip?: any;
  linkTargetBlank?: boolean;

  preserveFormat?: boolean;
}

interface Props extends Themeable {
  data?: TableData;
  showHeader: boolean;
  styles: ColumnStyle[];
  replaceVariables: InterpolateFunction;
  width: number;
  height: number;
}

interface State {
  sortBy?: number;
  sortDirection?: SortDirectionType;
  data?: TableData;
}

export class DataTable extends Component<Props, State> {
  renderer: TableRenderer;

  static defaultProps = {
    showHeader: true,
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      data: props.data,
    };

    this.renderer = this.createRenderer();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { data, styles } = this.props;
    const { sortBy, sortDirection } = this.state;
    const dataChanged = data !== prevProps.data;

    // Update the renderer if options change
    if (dataChanged || styles !== prevProps.styles) {
      this.renderer = this.createRenderer();
    }

    // Update the data when data or sort changes
    if (dataChanged || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      this.setState({ data: sortTableData(data, sortBy, sortDirection === 'DESC') });
    }
  }

  // styles: ColumnStyle[],
  // schema: Column[],
  // rowGetter: (info: Index) => any[], // matches the table rowGetter
  // replaceVariables: InterpolateFunction,
  // isUTC?: boolean, // TODO? get UTC from props?
  // theme?: GrafanaThemeType | undefined,

  createRenderer(): TableRenderer {
    const { styles, replaceVariables, theme } = this.props;
    const { data } = this.state;

    return new TableRenderer({
      styles,
      schema: data ? data.columns : [],
      rowGetter: this.rowGetter,
      replaceVariables,
      isUTC: false,
      theme: theme.type,
    });
  }

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
    return this.renderer.renderCell(columnIndex, rowIndex, val);
  };

  render() {
    const { width, height, showHeader } = this.props;
    const { data } = this.props;
    if (!data) {
      return <div>NO Data</div>;
    }
    return (
      <Table
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
            <Column
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
      </Table>
    );
  }
}

export default DataTable;
