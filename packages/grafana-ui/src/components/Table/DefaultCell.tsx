import { cx } from '@emotion/css';
import React, { FC, ReactElement } from 'react';
import tinycolor from 'tinycolor2';

import { DisplayValue, Field, formattedValueToString } from '@grafana/data';
import { TableCellBackgroundDisplayMode } from '@grafana/schema';

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
  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = tableStyles.theme.isDark ? 1 : -0.7;

  // See if we're using deprecated settings
  const usingDeprecatedSettings =
    field.config.custom.cellOptions.subOptions[TableCellDisplayMode.ColorBackground] === undefined;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;

  // Set colors using deprecated settings format
  if (usingDeprecatedSettings) {
    if (field.config.custom?.displayMode === TableCellDisplayMode.ColorText) {
      textColor = displayValue.color;
    } else if (field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
    } else if (
      field.config.custom?.displayMode === TableCellDisplayMode.ColorBackground &&
      field.config.custom?.backgroundDisplayMode === TableCellBackgroundDisplayMode.Gradient
    ) {
      const bgColor2 = tinycolor(displayValue.color)
        .darken(10 * darkeningFactor)
        .spin(5);
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
    }
  }
  // Set colors using updated sub-options format
  else {
    const displayMode = field.config.custom.cellOptions.subOptions[TableCellDisplayMode.ColorBackground].displayMode;

    if (field.config.custom.cellOptions.displayMode === TableCellDisplayMode.ColorText) {
      textColor = displayValue.color;
    } else if (displayMode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
    } else if (displayMode === TableCellBackgroundDisplayMode.Gradient) {
      const bgColor2 = tinycolor(displayValue.color)
        .darken(10 * darkeningFactor)
        .spin(5);
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
    }
  }

  // If we have definied colors return those styles
  // Otherwise we return default styles
  if (textColor !== undefined && bgColor !== undefined) {
    return tableStyles.buildCellContainerStyle(textColor, bgColor, !disableOverflowOnHover);
  }

  return disableOverflowOnHover ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer;
}
