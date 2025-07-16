import { formattedValueToString } from '@grafana/data';

import { AutoCellProps } from '../types';

import { TableCellLinkWraper } from './TableCellLinkWrapper';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  return (
    <TableCellLinkWraper field={field} rowIdx={rowIdx}>
      {formattedValueToString(field.display!(value))}
    </TableCellLinkWraper>
  );
}
