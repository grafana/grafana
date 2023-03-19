import React from 'react';

import { Badge } from '@grafana/ui';
import { TableCellProps } from '@grafana/ui/src/components/Table/types';

export function StatusCell(props: TableCellProps) {
  const displayValue = props.field.display!(props.cell.value);

  const lastCell = props.row.cells[props.row.cells.length - 1];
  const color = lastCell.value > 0 ? 'red' : 'green';

  return <Badge text={displayValue.text} color={color} />;
}
