import { cx } from '@emotion/css';
import React, { ReactElement } from 'react';
import tinycolor from 'tinycolor2';

import { DisplayValue, formattedValueToString } from '@grafana/data';
import { TableCellBackgroundDisplayMode, TableCellOptions } from '@grafana/schema';

import { useStyles2 } from '../../themes';
import { getCellLinks, getTextColorForAlphaBackground } from '../../utils';
import { clearLinkButtonStyles } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { CellActions } from './CellActions';
import { TableStyles } from './styles';
import { TableCellDisplayMode, TableCellProps, TableFieldOptions } from './types';
import { getCellOptions } from './utils';

export const DefaultCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps } = props;

  const inspectEnabled = Boolean((field.config.custom as TableFieldOptions)?.inspect);
  const displayValue = field.display!(cell.value);

  let value: string | ReactElement;
  if (React.isValidElement(cell.value)) {
    value = cell.value;
  } else {
    value = formattedValueToString(displayValue);
  }

  const showFilters = props.onCellFilterAdded && field.config.filterable;
  const showActions = (showFilters && cell.value !== undefined) || inspectEnabled;
  const cellOptions = getCellOptions(field);
  const cellStyle = getCellStyle(tableStyles, cellOptions, displayValue, inspectEnabled);
  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);

  return (
    <div {...cellProps} className={cellStyle}>
      {!hasLinks && <div className={tableStyles.cellText}>{value}</div>}

      {hasLinks && (
        <DataLinksContextMenu links={() => getCellLinks(field, row) || []}>
          {(api) => {
            if (api.openMenu) {
              return (
                <button
                  className={cx(clearButtonStyle, getLinkStyle(tableStyles, cellOptions, api.targetClassName))}
                  onClick={api.openMenu}
                >
                  {value}
                </button>
              );
            } else {
              return <div className={getLinkStyle(tableStyles, cellOptions, api.targetClassName)}>{value}</div>;
            }
          }}
        </DataLinksContextMenu>
      )}

      {showActions && <CellActions {...props} previewMode="text" showFilters={showFilters} />}
    </div>
  );
};

function getCellStyle(
  tableStyles: TableStyles,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue,
  disableOverflowOnHover = false
) {
  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = tableStyles.theme.isDark ? 1 : -0.7;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      const bgColor2 = tinycolor(displayValue.color)
        .darken(10 * darkeningFactor)
        .spin(5);
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
    }
  }

  // If we have definied colors return those styles
  // Otherwise we return default styles
  if (textColor !== undefined || bgColor !== undefined) {
    return tableStyles.buildCellContainerStyle(textColor, bgColor, !disableOverflowOnHover);
  }

  return disableOverflowOnHover ? tableStyles.cellContainerNoOverflow : tableStyles.cellContainer;
}

function getLinkStyle(tableStyles: TableStyles, cellOptions: TableCellOptions, targetClassName: string | undefined) {
  if (cellOptions.type === TableCellDisplayMode.Auto) {
    return cx(tableStyles.cellLink, targetClassName);
  }

  return cx(tableStyles.cellLinkForColoredCell, targetClassName);
}
