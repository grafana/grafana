import React, { FC, MouseEventHandler } from 'react';
import { DisplayValue, Field, formattedValueToString, LinkModel } from '@grafana/data';

import { TableCellDisplayMode, TableCellProps } from './types';
import tinycolor from 'tinycolor2';
import { TableStyles } from './styles';
import { getTextAlign } from './utils';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row } = props;
  let link: LinkModel<any> | undefined;

  const displayValue = field.display!(cell.value);

  if (field.getLinks) {
    link = field.getLinks({
      valueRowIndex: row.index,
    })[0];
  }

  const value = formattedValueToString(displayValue);

  let cellStyle = getCellStyle(tableStyles, field, displayValue);

  if (!link) {
    return <div className={cellStyle}>{value}</div>;
  }

  let onClick: MouseEventHandler<HTMLAnchorElement> | undefined;
  if (link.onClick) {
    onClick = event => {
      // Allow opening in new tab
      if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link!.onClick) {
        event.preventDefault();
        link!.onClick(event);
      }
    };
  }

  return (
    <div className={cellStyle}>
      <a
        href={link.href}
        onClick={onClick}
        target={link.target}
        title={link.title}
        className={tableStyles.tableCellLink}
      >
        {value}
      </a>
    </div>
  );
};

function getCellStyle(tableStyles: TableStyles, field: Field, displayValue: DisplayValue) {
  let textAlign = getTextAlign(field);

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorText) {
    return tableStyles.getCellStyle(displayValue.color, undefined, textAlign);
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
    const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
    const bgColor2 = tinycolor(displayValue.color)
      .darken(10 * themeFactor)
      .spin(5)
      .toRgbString();

    return tableStyles.getCellStyle('white', `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`);
  }

  return tableStyles.getCellStyle(undefined, undefined, textAlign);
}
