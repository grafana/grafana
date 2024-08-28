import 'react-data-grid/lib/styles.css';

import { css } from '@emotion/css';
import DataGrid, { Column, RenderRowProps, Row } from 'react-data-grid';
import { Cell } from 'react-table';

import { DataFrame, Field } from '@grafana/data';

import { useTheme2 } from '../../../themes';
import { TableCellDisplayMode, TableNGProps } from '../types';

import { TableCellNG } from './Cells/TableCellNG';
import { getCellColors } from '../utils';

const DEFAULT_CELL_PADDING = 6;

interface TableRow {
  id: number;
  title: string;
  cell: Cell;
}

interface TableColumn extends Column<TableRow> {
  key: string;
  name: string;
  rowHeight: number;
  field: Omit<Field, "values">;
}



export function TableNG(props: TableNGProps) {
  const { height, width, timeRange, cellHeight } = props;
  const theme = useTheme2();

  function rowHeight() {
    const bodyFontSize = theme.typography.fontSize;
    const lineHeight = theme.typography.body.lineHeight;

    switch (cellHeight) {
      case 'md':
        return 42;
      case 'lg':
        return 48;
    }

    return DEFAULT_CELL_PADDING * 2 + bodyFontSize * lineHeight;
  }
  const rowHeightNumber = rowHeight();


  const mapFrameToDataGrid = (main: DataFrame) => {
    const columns: TableColumn[] = [];
    const rows: Array<{ [key: string]: string }> = [];



    main.fields.map((field) => {
      const key = field.name;
      const { values: _, ...shallowField } = field;

      // Add a column for each field
      columns.push({
        key,
        name: key,
        field: shallowField,
        rowHeight: rowHeightNumber,
        cellClass: (row) => {
          console.log(row);
          // eslint-ignore-next-line
          const value = row[key];
          const displayValue = shallowField.display!(value);

          console.log(value);
          // if (shallowField.config.custom.type === TableCellDisplayMode.ColorBackground) {
          let colors = getCellColors(theme, shallowField.config.custom, displayValue);
          console.log(colors);
          // }

          // css()
          return 'my-class';
        },
        renderCell: (props: any) => {
          const { row } = props;
          const value = row[key];


          // Cell level rendering here
          return <TableCellNG
            key={key}
            value={value}
            field={shallowField}
            theme={theme}
            timeRange={timeRange}
            height={rowHeight}
          />
        }
      });

      // Create row objects
      field.values.map((value, index) => {
        const currentValue = { [key]: value };

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
  const { columns, rows } = mapFrameToDataGrid(props.data);

  // Return the data grid
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      defaultColumnOptions={{
        sortable: true,
        resizable: true,
        maxWidth: 200,
      }}

      rowHeight={rowHeightNumber}
      // TODO: This doesn't follow current table behavior
      style={{ width, height }}
      renderers={{ renderRow: myRowRenderer }}
    />
  );

}


function myRowRenderer(key: React.Key, props: RenderRowProps<Row>) {
  // Let's render row level things here!
  // i.e. we can look at row styles and such here
  return (
    <Row {...props} />
  );
}
