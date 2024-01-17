import React from 'react';

import { getCellLinks } from '../../utils';

import { getCellStyle } from './DefaultCell';
import { TableCellProps } from './types';
import { getCellOptions } from './utils';

export const DataLinksCell = (props: TableCellProps) => {
  const { field, row, cell, cellProps, tableStyles } = props;

  const links = getCellLinks(field, row);

  const displayValue = field.display!(cell.value);
  const cellOptions = getCellOptions(field);
  const cellStyle = getCellStyle(tableStyles, cellOptions, displayValue, false, true);

  return (
    <div {...cellProps} className={cellStyle}>
      {links &&
        links.map((link, idx) => {
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <span key={idx} className={tableStyles.cellLink} onClick={link.onClick}>
              <a href={link.href} target={link.target}>
                {link.title}
              </a>
            </span>
          );
        })}
    </div>
  );
};
