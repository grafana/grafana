// Libraries
import _ from 'lodash';
import React, { Component, ReactNode } from 'react';

// Types
import { PanelProps } from '@grafana/ui/src/types';
import { Options } from './types';
import { Table, SortDirectionType, SortIndicator, Column, TableHeaderProps, TableCellProps } from 'react-virtualized';

import { TableRenderer } from './renderer';

interface Props extends PanelProps<Options> {}

interface State {
  sortBy: string;
  sortDirection: SortDirectionType;
  sortedList: any[];
}

export class TablePanel extends Component<Props, State> {
  renderer: TableRenderer;

  constructor(props: Props) {
    super(props);
    this.state = {
      sortBy: 'XX',
      sortDirection: 'ASC',
      sortedList: [],
    };

    const { panelData, options, replaceVariables } = this.props;
    const theme = null; // TODO?

    this.renderer = new TableRenderer(panelData.tableData, options, replaceVariables, theme);
  }

  _rowGetter = ({ index }) => {
    return this.props.panelData.tableData.rows[index];
  };

  _sort = ({ sortBy, sortDirection }) => {
    // const sortedList = this._sortList({sortBy, sortDirection});

    // this.setState({sortBy, sortDirection, sortedList});
    console.log('TODO, sort!', sortBy, sortDirection);
  };

  _headerRenderer = (header: TableHeaderProps): ReactNode => {
    const { sortBy, dataKey, sortDirection } = header;
    const tableData = this.props.panelData.tableData!;
    const col = tableData.columns[dataKey];
    if (!col) {
      return <div>??{dataKey}??</div>;
    }

    return (
      <div>
        {col.text} {sortBy === dataKey && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  _cellRenderer = (cell: TableCellProps) => {
    const { columnIndex, rowIndex } = cell;
    const tableData = this.props.panelData.tableData!;
    const val = tableData.rows[rowIndex][columnIndex];
    return this.renderer.renderCell(columnIndex, rowIndex, val);
  };

  render() {
    const { panelData, width, height, options } = this.props;
    const { showHeader } = options;
    const { sortBy, sortDirection } = this.state;
    const { tableData } = panelData;

    if (!tableData || tableData.rows.length < 1) {
      return <div>No Table Data...</div>;
    }

    return (
      <Table
        disableHeader={!showHeader}
        headerHeight={30}
        height={height}
        overscanRowCount={10}
        rowHeight={30}
        rowGetter={this._rowGetter}
        rowCount={tableData.rows.length}
        sort={this._sort}
        sortBy={sortBy}
        sortDirection={sortDirection}
        width={width}
      >
        {tableData.columns.map((col, index) => {
          return (
            <Column
              key={index}
              dataKey={index}
              headerRenderer={this._headerRenderer}
              cellRenderer={this._cellRenderer}
              flexGrow={1}
              width={60}
            />
          );
        })}
      </Table>
    );
  }
}
