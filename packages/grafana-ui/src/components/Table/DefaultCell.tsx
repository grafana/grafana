import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString, LinkModel } from '@grafana/data';
import { Tooltip } from '../Tooltip/Tooltip';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row } = props;
  let link: LinkModel<any> | undefined;

  const displayValue = field.display ? field.display(cell.value) : cell.value;

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }
  const value = field.display ? formattedValueToString(displayValue) : displayValue;

  return (
    <div className={tableStyles.tableCell}>
      {link ? (
        <Tooltip content={link.title}>
          <a href={link.href} target={link.target} title={link.title} className={tableStyles.tableCellLink}>
            {value}
          </a>
        </Tooltip>
      ) : (
        value
      )}
    </div>
  );
};
