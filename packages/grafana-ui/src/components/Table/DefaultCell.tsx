import React, { FC, MouseEventHandler } from 'react';
import { DisplayValue, Field, formattedValueToString, LinkModel } from '@grafana/data';

import { TableCellDisplayMode, TableCellProps } from './types';
import tinycolor from 'tinycolor2';
import { TableStyles } from './styles';
import { FilterActions } from './FilterActions';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const displayValue = field.display!(cell.value);
  const value = formattedValueToString(displayValue);
  const cellStyle = getCellStyle(tableStyles, field, displayValue);
  const showFilters = field.config.filterable;

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

  return (
    <div {...cellProps} className={cellStyle}>
      {!link && <div className={tableStyles.cellText}>{value}</div>}
      {link && (
        <a href={link.href} onClick={onClick} target={link.target} title={link.title} className={tableStyles.cellLink}>
          {value}
        </a>
      )}
      {showFilters && cell.value && <FilterActions {...props} />}
    </div>
  );
};

function getCellStyle(tableStyles: TableStyles, field: Field, displayValue: DisplayValue) {
  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorText) {
    return tableStyles.buildCellContainerStyle(displayValue.color);
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
    const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
    const bgColor2 = tinycolor(displayValue.color)
      .darken(10 * themeFactor)
      .spin(5)
      .toRgbString();

    return tableStyles.buildCellContainerStyle('white', `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`);
  }

  return tableStyles.cellContainer;
}
