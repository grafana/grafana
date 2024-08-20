import 'react-data-grid/lib/styles.css';

import { Component } from 'react';
import DataGrid from 'react-data-grid';

import { DataFrame } from '@grafana/data';

import { TableNGProps } from '../types';

export class TableNG extends Component<TableNGProps> {

  mapFrameToDataGrid(main: DataFrame) {
    const columns: Array<{ key: string; name: string }> = [];
    const rows: Array<{ [key: string]: string }> = [];

    main.fields.map((field) => {
      const key = field.name;
      columns.push({ key, name: key }); // TODO add display function output
      field.values.map((value, index) => {
        const currentValue = { [key]: String(value) };
        if (rows.length > index) {
          rows[index] = { ...rows[index], ...currentValue };
        } else {
          rows[index] = currentValue;
        }
      });
    });

    return {
      columns, rows
    }
  }


  render() {
    const { columns, rows } = this.mapFrameToDataGrid(this.props.data);

    return (
      <DataGrid
        rows={rows}
        columns={columns}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
          maxWidth: 200,
        }}
      />
    );
  }
}
