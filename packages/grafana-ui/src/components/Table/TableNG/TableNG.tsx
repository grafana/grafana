import 'react-data-grid/lib/styles.css';

import { Component } from 'react';
import DataGrid, { Column } from 'react-data-grid';
import { Cell } from 'react-table';

import { DataFrame } from '@grafana/data';

import { TableCell } from '../Cells/TableCell';
import { TableNGProps } from '../types';


interface TableColumn {
  key: string;
  name: string;
  renderCell: Function;
}

interface TableRow {
  id: number;
  title: string;
  cell: Cell;
}

export class TableNG extends Component<TableNGProps> {

  mapFrameToDataGrid(main: DataFrame) {
    const columns: Array<Column<TableRow>> = [];
    const rows: Array<{ [key: string]: string }> = [];

    main.fields.map((field) => {
      const key = field.name;

      columns.push({
        key, name: key, renderCell: (props: any) => {
          console.log(props);
          return <TableCell {...props} />
        }
      });

      console.log(field);


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
