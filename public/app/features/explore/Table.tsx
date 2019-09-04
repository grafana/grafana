import _ from 'lodash';
import React, { PureComponent } from 'react';
import ReactTable, { RowInfo } from 'react-table';

import TableModel from 'app/core/table_model';

const EMPTY_TABLE = new TableModel();
// Identify columns that contain values
const VALUE_REGEX = /^[Vv]alue #\d+/;

interface TableProps {
  data: TableModel;
  loading: boolean;
  onClickCell?: (columnKey: string, rowValue: string) => void;
}

function prepareRows(rows: any[], columnNames: string[]) {
  return rows.map(cells => _.zipObject(columnNames, cells));
}

export default class Table extends PureComponent<TableProps> {
  getCellProps = (state: any, rowInfo: RowInfo, column: any) => {
    return {
      onClick: (e: React.SyntheticEvent) => {
        // Only handle click on link, not the cell
        if (e.target) {
          const link = e.target as HTMLElement;
          if (link.className === 'link') {
            const columnKey = column.Header().props.title;
            const rowValue = rowInfo.row[columnKey];
            this.props.onClickCell(columnKey, rowValue);
          }
        }
      },
    };
  };

  render() {
    const { data, loading } = this.props;
    const tableModel = data || EMPTY_TABLE;
    const columnNames = tableModel.columns.map(({ text }) => text);
    const columns = tableModel.columns.map(({ filterable, text }) => ({
      Header: () => <span title={text}>{text}</span>,
      accessor: text,
      className: VALUE_REGEX.test(text) ? 'text-right' : '',
      show: text !== 'Time',
      Cell: (row: any) => (
        <span className={filterable ? 'link' : ''} title={text + ': ' + row.value}>
          {typeof row.value === 'string' ? row.value : JSON.stringify(row.value)}
        </span>
      ),
    }));
    const noDataText = data ? 'The queries returned no data for a table.' : '';

    return (
      <ReactTable
        columns={columns}
        data={tableModel.rows}
        getTdProps={this.getCellProps}
        loading={loading}
        minRows={0}
        noDataText={noDataText}
        resolveData={data => prepareRows(data, columnNames)}
        showPagination={Boolean(data)}
      />
    );
  }
}
