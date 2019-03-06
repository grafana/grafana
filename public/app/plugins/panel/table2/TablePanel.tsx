// Libraries
import _ from 'lodash';
import React, { PureComponent } from 'react';

// Types
import { PanelProps } from '@grafana/ui/src/types';
import { Options } from './types';

import { Table, Index, Column } from 'react-virtualized';

interface Props extends PanelProps<Options> {}

export class TablePanel extends PureComponent<Props> {
  getRow = (index: Index): any => {
    const { panelData } = this.props;
    if (panelData.tableData) {
      return panelData.tableData.rows[index.index];
    }
    return null;
  };

  render() {
    const { panelData, width, height, options } = this.props;
    const { showHeader } = options;

    const headerClassName = null;
    const headerHeight = 30;
    const rowHeight = 20;

    let rowCount = 0;
    if (panelData.tableData) {
      rowCount = panelData.tableData.rows.length;
    } else {
      return <div>No Table Data...</div>;
    }

    return (
      <div>
        <Table
          disableHeader={!showHeader}
          headerClassName={headerClassName}
          headerHeight={headerHeight}
          height={height}
          overscanRowCount={5}
          rowHeight={rowHeight}
          rowGetter={this.getRow}
          rowCount={rowCount}
          width={width}
        >
          {panelData.tableData.columns.map((col, index) => {
            return (
              <Column
                label={col.text}
                cellDataGetter={({ rowData }) => {
                  return rowData[index];
                }}
                dataKey={index}
                disableSort={true}
                width={100}
              />
            );
          })}
        </Table>
      </div>
    );
  }
}
