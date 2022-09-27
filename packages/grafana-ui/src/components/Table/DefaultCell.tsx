import { cx } from '@emotion/css';
import React, { FC, ReactElement } from 'react';
import tinycolor from 'tinycolor2';

import { DisplayValue, Field, formattedValueToString } from '@grafana/data';

import { getCellLinks, getTextColorForAlphaBackground } from '../../utils';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { CellActions } from './CellActions';
import { TableStyles } from './styles';
import { TableCellDisplayMode, TableCellProps, TableFieldOptions } from './types';

export const DefaultCell: FC<TableCellProps> = (props) => {
  const { field, cell, tableStyles, row, cellProps } = props;

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

  const hasLinks = Boolean(getCellLinks(field, row)?.length);

  return (
    <div {...cellProps} className={cellStyle}>
      {!hasLinks && <div className={tableStyles.cellText}>{value}</div>}

      {hasLinks && (
        <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
          {(api) => {
            return (
              <div onClick={api.openMenu} className={cx(tableStyles.cellLink, api.targetClassName)}>
                {value}
              </div>
            );
          }}
        </DataLinksContextMenu>
      )}

      {showActions && <CellActions {...props} previewMode="text" />}
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
    const textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
    return tableStyles.buildCellContainerStyle(textColor, bgColor.toRgbString(), !disableOverflowOnHover);
  }

  if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
    const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
    const bgColor2 = tinycolor(displayValue.color)
      .darken(10 * themeFactor)
      .spin(5)
      .toRgbString();

    const textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);

    return tableStyles.buildCellContainerStyle(
      textColor,
      `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`,
      !disableOverflowOnHover
    );
  }

  return disableOverflowOnHover ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer;
}
