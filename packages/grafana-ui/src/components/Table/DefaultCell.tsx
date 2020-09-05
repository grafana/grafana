import React, { FC } from 'react';
import { formattedValueToString, LinkModel } from '@grafana/data';

import { TableCellProps } from './types';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row } = props;
  let link: LinkModel<any> | undefined;

  const displayValue = field.display ? field.display(cell.value) : cell.value;

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }
  const value = field.display ? formattedValueToString(displayValue) : `${displayValue}`;

  if (!link) {
    return <div className={tableStyles.tableCell}>{value}</div>;
  }

  return (
    <div className={tableStyles.tableCell}>
      <a
        href={link.href}
        onClick={
          link.onClick
            ? event => {
                // Allow opening in new tab
                if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
                  event.preventDefault();
                  link!.onClick(event);
                }
              }
            : undefined
        }
        target={link.target}
        title={link.title}
        className={tableStyles.tableCellLink}
      >
        {value}
      </a>
    </div>
  );
};
