import { LinkModel } from '@grafana/data';
import React, { FC, MouseEventHandler } from 'react';
import { TableCellProps } from './types';

export const ImageCell: FC<TableCellProps> = (props) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);

  let link: LinkModel<any> | undefined;
  let onClick: MouseEventHandler<HTMLAnchorElement> | undefined;

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }

  if (link && link.onClick) {
    onClick = (event) => {
      // Allow opening in new tab
      if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
        event.preventDefault();
        link!.onClick(event);
      }
    };
  }

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {!link && <img src={displayValue.text} className={tableStyles.imageCell} />}
      {link && (
        <a
          href={link.href}
          onClick={onClick}
          target={link.target}
          title={link.title}
          className={tableStyles.imageCellLink}
        >
          <img src={displayValue.text} className={tableStyles.imageCell} />
        </a>
      )}
    </div>
  );
};
