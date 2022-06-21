import React, { FC, ReactElement, useState } from 'react';
import tinycolor from 'tinycolor2';

import { CartesianCoords2D, DisplayValue, Field, formattedValueToString } from '@grafana/data';

import { getTextColorForBackground, getCellLinks } from '../../utils';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { MenuItem } from '../Menu/MenuItem';

import { CellActions } from './CellActions';
import { TableStyles } from './styles';
import { TableCellDisplayMode, TableCellProps, TableFieldOptions } from './types';

export const DefaultCell: FC<TableCellProps> = (props) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const [clickPosition, setClickPostion] = useState<CartesianCoords2D | null>(null);

  const inspectEnabled = Boolean((field.config.custom as TableFieldOptions)?.inspect);
  const displayValue = field.display!(cell.value);

  let value: string | ReactElement;
  if (React.isValidElement(cell.value)) {
    value = cell.value;
  } else {
    value = formattedValueToString(displayValue);
  }

  const showFilters = field.config.filterable;
  const showActions = (showFilters && cell.value !== undefined) || inspectEnabled;
  const cellStyle = getCellStyle(tableStyles, field, displayValue, inspectEnabled);

  const cellLinks = getCellLinks(field, row);

  const renderDataLinks = () => {
    return cellLinks
      ? cellLinks.map((l) => {
          return (
            <MenuItem key={`data-link/${l.title}`} url={l.href} label={l.title} target={l.target} onClick={l.onClick} />
          );
        })
      : null;
  };

  return (
    <div {...cellProps} className={cellStyle}>
      {!cellLinks || (cellLinks.length === 0 && <div className={tableStyles.cellText}>{value}</div>)}

      {cellLinks && cellLinks.length === 1 && (
        <a
          href={cellLinks[0].href}
          onClick={cellLinks[0].onClick}
          target={cellLinks[0].target}
          title={cellLinks[0].title}
          className={tableStyles.cellLink}
        >
          {value}
        </a>
      )}

      {cellLinks && cellLinks.length > 1 && (
        <a
          onClick={(e) => {
            setClickPostion({ x: e.clientX, y: e.clientY });
          }}
          className={tableStyles.cellLink}
        >
          {value}
        </a>
      )}

      {showActions && <CellActions {...props} previewMode="text" />}

      {cellLinks && cellLinks.length > 1 && clickPosition && (
        <ContextMenu
          x={clickPosition.x}
          y={clickPosition.y}
          renderMenuItems={renderDataLinks}
          onClose={() => {
            setClickPostion(null);
          }}
        ></ContextMenu>
      )}
    </div>
  );
};

function getCellStyle(
  tableStyles: TableStyles,
  field: Field,
  displayValue: DisplayValue,
  disableOverflowOnHover = false
) {
  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorText) {
    return tableStyles.buildCellContainerStyle(displayValue.color, undefined, !disableOverflowOnHover);
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackgroundSolid) {
    const bgColor = tinycolor(displayValue.color);
    const textColor = getTextColorForBackground(displayValue.color!);
    return tableStyles.buildCellContainerStyle(textColor, bgColor.toRgbString(), !disableOverflowOnHover);
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
    const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
    const bgColor2 = tinycolor(displayValue.color)
      .darken(10 * themeFactor)
      .spin(5)
      .toRgbString();

    const textColor = getTextColorForBackground(displayValue.color!);

    return tableStyles.buildCellContainerStyle(
      textColor,
      `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`,
      !disableOverflowOnHover
    );
  }

  return disableOverflowOnHover ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer;
}
