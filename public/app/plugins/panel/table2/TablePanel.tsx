// Libraries
import _ from 'lodash';
import React, { Component, ReactNode } from 'react';

// Types
import { PanelProps, ThemeContext, TableData } from '@grafana/ui';
import { Options } from './types';
import { Table, SortDirectionType, SortIndicator, Column, TableHeaderProps, TableCellProps } from 'react-virtualized';

import { TableRenderer } from './renderer';
import { sortTableData } from './sortable';

interface Props extends PanelProps<Options> {}

interface State {
  sortBy?: number;
  sortDirection?: SortDirectionType;
  data: TableData;
}

export class TablePanel extends Component<Props, State> {
  renderer: TableRenderer;

  constructor(props: Props) {
    super(props);

    const { panelData, options, replaceVariables } = this.props;

    this.state = {
      data: panelData.tableData,
    };

    this.renderer = new TableRenderer(options.styles, this.state.data.columns, this.rowGetter, replaceVariables);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { panelData, options } = this.props;
    const { sortBy, sortDirection } = this.state;

    // Update the renderer if options change
    if (options !== prevProps.options) {
      this.renderer = new TableRenderer(
        options.styles,
        this.state.data.columns,
        this.rowGetter,
        this.props.replaceVariables
      );
    }

    // Update the data when data or sort changes
    if (panelData !== prevProps.panelData || sortBy !== prevState.sortBy || sortDirection !== prevState.sortDirection) {
      const data = sortTableData(panelData.tableData, sortBy, sortDirection === 'DESC');
      this.setState({ data });
    }
  }

  rowGetter = ({ index }) => {
    return this.state.data.rows[index];
  };

  doSort = ({ sortBy }) => {
    let sortDirection = this.state.sortDirection;
    if (sortBy !== this.state.sortBy) {
      sortDirection = 'DESC';
    } else if (sortDirection === 'DESC') {
      sortDirection = 'ASC';
    } else {
      sortBy = null;
    }

    this.setState({ sortBy, sortDirection });
  };

  headerRenderer = (header: TableHeaderProps): ReactNode => {
    const dataKey = header.dataKey as any; // types say string, but it is number!
    const { data, sortBy, sortDirection } = this.state;
    const col = data.columns[dataKey];

    return (
      <div>
        {col.text} {sortBy === dataKey && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  cellRenderer = (cell: TableCellProps) => {
    const { columnIndex, rowIndex } = cell;
    const row = this.state.data.rows[rowIndex];
    const val = row[columnIndex];
    return this.renderer.renderCell(columnIndex, rowIndex, val);
  };

  render() {
    const { width, height, options } = this.props;
    const { showHeader } = options;
    //   const { sortBy, sortDirection } = this.state;
    const { data } = this.state;

    if (!data) {
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
        )}
      </ThemeContext.Consumer>
    );
  }
}
