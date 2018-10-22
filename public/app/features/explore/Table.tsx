import _ from 'lodash';
import React, { PureComponent } from 'react';
import ReactTable from 'react-table';

import TableModel from 'app/core/table_model';

const EMPTY_TABLE = new TableModel();
// Identify columns that contain values
const VALUE_REGEX = /^[Vv]alue #\d+/;

interface TableProps {
  data: TableModel;
  loading: boolean;
  onClickCell?: (columnKey: string, rowValue: string) => void;
}

function prepareRows(rows, columnNames) {
  return rows.map(cells => _.zipObject(columnNames, cells));
}

export default class Table extends PureComponent<TableProps> {
  getCellProps = (state, rowInfo, column) => {
    return {
      onClick: () => {
        const columnKey = column.Header;
        const rowValue = rowInfo.row[columnKey];
        this.props.onClickCell(columnKey, rowValue);
      },
    };
  };

  render() {
    const { data, loading } = this.props;
    const tableModel = data || EMPTY_TABLE;
    const columnNames = tableModel.columns.map(({ text }) => text);
    const columns = tableModel.columns.map(({ filterable, text }) => ({
      Header: text,
      accessor: text,
      className: VALUE_REGEX.test(text) ? 'text-right' : '',
      show: text !== 'Time',
      Cell: row => <span className={filterable ? 'link' : ''}>{row.value}</span>,
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
