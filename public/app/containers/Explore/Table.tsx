import React, { PureComponent } from 'react';
// import TableModel from 'app/core/table_model';

const EMPTY_TABLE = {
  columns: [],
  rows: [],
};

export default class Table extends PureComponent<any, any> {
  render() {
    const { className = '', data } = this.props;
    const tableModel = data || EMPTY_TABLE;
    return (
      <table className={`${className} filter-table`}>
        <thead>
          <tr>{tableModel.columns.map(col => <th key={col.text}>{col.text}</th>)}</tr>
        </thead>
        <tbody>
          {tableModel.rows.map((row, i) => <tr key={i}>{row.map((content, j) => <td key={j}>{content}</td>)}</tr>)}
        </tbody>
      </table>
    );
  }
}
