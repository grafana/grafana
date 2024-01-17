import React from 'react';

import { getCellLinks } from '../../utils';

import { getCellStyle, getLinkStyle } from './DefaultCell';
import { TableCellProps } from './types';
import { getCellOptions } from './utils';

export const DataLinksCell = (props: TableCellProps) => {
  const { field, row, cell, cellProps, tableStyles } = props;

  const links = getCellLinks(field, row);

  const displayValue = field.display!(cell.value);
  const cellOptions = getCellOptions(field);

  const cellStyle = getCellStyle(tableStyles, cellOptions, displayValue, false, true);
  const linkStyle = getLinkStyle(tableStyles, cellOptions, undefined);

  return (
    <div {...cellProps} className={cellStyle}>
      {links &&
        links.map((link, idx) => {
          // if(link.onClick) {
          //   return <a key={idx} onClick={(e) => {
          //     link.onClick!(e)
          //   }} target={link.target}>{link.title}</a>;
          // }
          return (
            <span key={idx} className={tableStyles.cellLink}>
              <a href={link.href} target={link.target}>
                {link.title}
              </a>
            </span>
          );
        })}
    </div>
  );
};

// <div className={getLinkStyle(tableStyles, cellOptions, api.targetClassName)}>{value}</div>;

// <div className={tableStyles.cellText}>{value}</div>
