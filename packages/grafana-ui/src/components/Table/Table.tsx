import { TableNG } from './TableNG/TableNG';
import { Table as TableRT } from './TableRT/Table';
import { GeneralTableProps } from './types';

export function Table(props: GeneralTableProps) {
  let table = props.useTableNg ? <TableNG {...props} /> : <TableRT {...props} />;
  return table;
}
