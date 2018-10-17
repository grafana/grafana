import _ from 'lodash';
import React, { PureComponent } from 'react';
import ReactTable from 'react-table';

import TableModel from 'app/core/table_model';

const EMPTY_TABLE = new TableModel();

interface TableProps {
  className?: string;
  data: TableModel;
  loading: boolean;
  onClickCell?: (columnKey: string, rowValue: string) => void;
}

function prepareRows(rows, columnNames) {
  return rows.map(cells => _.zipObject(columnNames, cells));
}

export default class Table extends PureComponent<TableProps, {}> {
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
      show: text !== 'Time',
      Cell: row => <span className={filterable ? 'link' : ''}>{row.value}</span>,
    }));

    return (
      <ReactTable
        columns={columns}
        data={tableModel.rows}
        getTdProps={this.getCellProps}
        loading={loading}
        minRows={0}
        noDataText="No data returned from query."
        resolveData={data => prepareRows(data, columnNames)}
      />
    );
  }
}
