// Libraries
import _ from 'lodash';
import React, { Component, ReactNode } from 'react';

// Types
import { PanelProps, ThemeContext } from '@grafana/ui';
import { Options } from './types';
import { Table, SortDirectionType, SortIndicator, Column, TableHeaderProps, TableCellProps } from 'react-virtualized';

import { TableRenderer } from './renderer';
import { SortedTableData } from './sortable';

interface Props extends PanelProps<Options> {}

interface State {
  sortBy?: number; // but really is a number!
  sortDirection?: SortDirectionType;
  data: SortedTableData;
}

export class TablePanel extends Component<Props, State> {
  renderer: TableRenderer;

  constructor(props: Props) {
    super(props);

    const { panelData, options, replaceVariables } = this.props;

    this.state = {
      data: new SortedTableData(panelData.tableData),
    };

    this.renderer = new TableRenderer(options.styles, this.state.data, this._rowGetter, replaceVariables);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { panelData, options } = this.props;
    const { sortBy, sortDirection } = this.state;

    console.log('componentDidUpdate', this.props);

    // Update the renderer if options change
    if (options !== prevProps.options) {
      console.log('Options Changed, update renderer', options);
      this.renderer = new TableRenderer(options.styles, this.state.data, this._rowGetter, this.props.replaceVariables);
    }

    // Update the data when data or sort changes
    if (panelData !== prevProps.panelData || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      const data = new SortedTableData(panelData.tableData, sortBy, sortDirection === 'DESC');
      this.setState({ data });
      console.log('Data Changed, update', data);
    }
  }

  _rowGetter = ({ index }) => {
    return this.state.data.getRow(index);
  };

  _sort = ({ sortBy }) => {
    let sortDirection = this.state.sortDirection;
    if (sortBy !== this.state.sortBy) {
      sortDirection = 'DESC';
    } else if (sortDirection === 'DESC') {
      sortDirection = 'ASC';
    } else {
      sortBy = null;
    }

    // This will trigger sort via properties
    console.log('SORT', sortBy, typeof sortBy, sortDirection);

    this.setState({ sortBy, sortDirection });
  };

  _headerRenderer = (header: TableHeaderProps): ReactNode => {
    const dataKey = header.dataKey as any; // types say string, but it is number?
    const { data, sortBy, sortDirection } = this.state;

    const col = data.getInfo()[dataKey];
    if (!col) {
      return <div>??{dataKey}??</div>;
    }

    const isSorted = sortBy === dataKey;

    console.log('header SORT', sortBy, isSorted);

    return (
      <div>
        {col.text} {isSorted && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  _cellRenderer = (cell: TableCellProps) => {
    const { columnIndex, rowIndex } = cell;
    const row = this.state.data.getRow(rowIndex);
    const val = row[columnIndex];
    return this.renderer.renderCell(columnIndex, rowIndex, val);
  };

  render() {
    const { panelData, width, height, options } = this.props;
    const { showHeader } = options;
    //   const { sortBy, sortDirection } = this.state;
    const { tableData } = panelData;

    if (!tableData || tableData.rows.length < 1) {
      return <div>No Table Data...</div>;
    }

    return (
      <ThemeContext.Consumer>
        {(
          theme // ??? { this.renderer.setTheme(theme) }
        ) => (
          <Table
            disableHeader={!showHeader}
            headerHeight={30}
            height={height}
            overscanRowCount={10}
            rowHeight={30}
            rowGetter={this._rowGetter}
            rowCount={tableData.rows.length}
            sort={this._sort}
            width={width}
          >
            {tableData.columns.map((col, index) => {
              return (
                <Column
                  key={index}
                  dataKey={index}
                  headerRenderer={this._headerRenderer}
                  cellRenderer={this._cellRenderer}
                  width={300}
                />
              );
            })}
          </Table>
        )}
      </ThemeContext.Consumer>
    );
  }
}
