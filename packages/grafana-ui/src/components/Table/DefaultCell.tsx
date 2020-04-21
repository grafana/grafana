import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString, LinkModel } from '@grafana/data';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row } = props;
  let link: LinkModel<any> | undefined;

  if (!field.display) {
    return null;
  }

  const displayValue = field.display(cell.value);

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }
  const value = formattedValueToString(displayValue);

  return (
    <div className={tableStyles.tableCell}>
      {link ? (
        <a href={link.href} target={link.target} title={link.title}>
          {value}
        </a>
      ) : (
        value
      )}
    </div>
  );
};
