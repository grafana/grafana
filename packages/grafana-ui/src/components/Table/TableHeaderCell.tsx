import React, { FC } from 'react';
import { Column } from 'react-table';
import { TableStyles } from './styles';
import { Field } from '@grafana/data';

interface Props {
  field: Field;
  column: Column;
  tableStyles: TableStyles;
}

export const TableHeaderCell: FC<Props> = ({ field, column, tableStyles }) => {
  const columnAsAny: any = column;
  const headerProps = columnAsAny.getHeaderProps(columnAsAny.getSortByToggleProps());
  const isSorted = columnAsAny.isSorted;
  const isSortedDesc = columnAsAny.isSortedDesc;

  return <div {...headerProps}>{columnAsAny.render('Header', { field, tableStyles, isSorted, isSortedDesc })}</div>;
};
