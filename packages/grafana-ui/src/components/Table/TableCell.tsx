import React, { FC } from 'react';
import { Cell, CellProps } from 'react-table';
import { Field } from '@grafana/data';
import { BackgroundColoredCell, DefaultCell } from './DefaultCell';
import { BarGaugeCell } from './BarGaugeCell';
import { getTextAlign } from './utils';
import { TableCellDisplayMode, TableFieldOptions, TableFilterActionCallback } from './types';
import { TableStyles } from './styles';

interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellClick?: TableFilterActionCallback;
}

export const TableCell: FC<Props> = ({ cell, field, tableStyles, onCellClick }) => {
  const filterable = field.config.filterable;
  const cellProps = cell.getCellProps();
  let onClick: ((event: React.SyntheticEvent) => void) | undefined = undefined;

  if (filterable && onCellClick) {
    if (cellProps.style) {
      cellProps.style.cursor = 'pointer';
    }

    onClick = () => onCellClick(cell.column.Header as string, cell.value);
  }
  const fieldTextAlign = getTextAlign(field);
  if (fieldTextAlign && cellProps.style) {
    cellProps.style.textAlign = fieldTextAlign;
  }

  let Cell = (cellProps: CellProps<any>) => <DefaultCell field={field} {...cellProps} tableStyles={tableStyles} />;
  const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;

  switch (fieldTableOptions.displayMode) {
    case TableCellDisplayMode.ColorBackground:
      Cell = (cellProps: CellProps<any>) => (
        <BackgroundColoredCell field={field} {...cellProps} tableStyles={tableStyles} />
      );
      break;
    case TableCellDisplayMode.LcdGauge:
    case TableCellDisplayMode.GradientGauge:
      Cell = (cellProps: CellProps<any>) => <BarGaugeCell field={field} {...cellProps} tableStyles={tableStyles} />;
      break;
  }

  cell.column.Cell = Cell;

  return (
    <div {...cellProps} onClick={onClick}>
      {cell.render('Cell')}
    </div>
  );
};
