import React, { FC, MouseEventHandler } from 'react';
import { DisplayValue, Field, formattedValueToString, LinkModel } from '@grafana/data';

import { TableCellDisplayMode, TableCellProps } from './types';
import tinycolor from 'tinycolor2';
import { TableStyles } from './styles';
import { getTextAlign } from './utils';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row } = props;

  if (!field.display) {
    return null;
  }

  const cellProps = cell.getCellProps();
  const displayValue = field.display(cell.value);
  const value = formattedValueToString(displayValue);
  const cellStyle = getCellStyle(tableStyles, field, displayValue);

  let link: LinkModel<any> | undefined;
  let onClick: MouseEventHandler<HTMLAnchorElement> | undefined;

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }

  if (link && link.onClick) {
    onClick = event => {
      // Allow opening in new tab
      if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
        event.preventDefault();
        link!.onClick(event);
      }
    };
  }

  if (cellProps.style) {
    cellProps.style.minWidth = cellProps.style.width;
  }

  return (
    <div {...cellProps} className={cellStyle}>
      {!link && <div className={tableStyles.cellText}>{value}</div>}
      {link && (
        <a
          href={link.href}
          onClick={onClick}
          target={link.target}
          title={link.title}
          className={tableStyles.tableCellLink}
        >
          {value}
        </a>
      )}
    </div>
  );
};

function getCellStyle(tableStyles: TableStyles, field: Field, displayValue: DisplayValue) {
  let textAlign = getTextAlign(field);

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorText) {
    return tableStyles.getCellStyle({ color: displayValue.color, justify: textAlign });
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
    const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
    const bgColor2 = tinycolor(displayValue.color)
      .darken(10 * themeFactor)
      .spin(5)
      .toRgbString();

    return tableStyles.getCellStyle({
      color: 'white',
      background: `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`,
      justify: textAlign,
    });
  }

  return tableStyles.getCellStyle({ justify: textAlign });
}
