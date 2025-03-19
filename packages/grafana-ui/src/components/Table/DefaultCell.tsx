import { cx } from '@emotion/css';
import { ReactElement } from 'react';
import * as React from 'react';

import { DisplayValue, formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../themes';
import { getCellLinks } from '../../utils';
import { clearLinkButtonStyles } from '../Button';
import { DataLinksContextMenu } from '../DataLinks/DataLinksContextMenu';

import { CellActions } from './CellActions';
import { TableCellInspectorMode } from './TableCellInspector';
import { TableStyles } from './styles';
import { TableCellProps, CustomCellRendererProps, TableCellOptions } from './types';
import { getCellColors, getCellOptions } from './utils';

export const DefaultCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps, frame, rowStyled, rowExpanded, textWrapped, height } = props;
  const inspectEnabled = Boolean(field.config.custom?.inspect);
  const displayValue = field.display!(cell.value);

  const showFilters = props.onCellFilterAdded && field.config.filterable;
  const showActions = (showFilters && cell.value !== undefined) || inspectEnabled;
  const cellOptions = getCellOptions(field);
  const hasLinks = Boolean(getCellLinks(field, row)?.length);
  const clearButtonStyle = useStyles2(clearLinkButtonStyles);
  let value: string | ReactElement;

  const OG_TWEET_LENGTH = 140; // 🙏

  if (cellOptions.type === TableCellDisplayMode.Custom) {
    const CustomCellComponent: React.ComponentType<CustomCellRendererProps> = cellOptions.cellComponent;
    value = <CustomCellComponent field={field} value={cell.value} rowIndex={row.index} frame={frame} />;
  } else {
    if (React.isValidElement(cell.value)) {
      value = cell.value;
    } else {
      value = formattedValueToString(displayValue);
    }
  }

  const isStringValue = typeof value === 'string';

  // Text should wrap when the content length is less than or equal to the length of an OG tweet and it contains whitespace
  const textShouldWrap = displayValue.text.length <= OG_TWEET_LENGTH && /\s/.test(displayValue.text);
  const cellStyle = getCellStyle(
    tableStyles,
    cellOptions,
    displayValue,
    inspectEnabled,
    isStringValue,
    textShouldWrap,
    textWrapped,
    rowStyled,
    rowExpanded
  );

  if (isStringValue) {
    let justifyContent = cellProps.style?.justifyContent;

    if (justifyContent === 'flex-end') {
      cellProps.style = { ...cellProps.style, textAlign: 'right' };
    } else if (justifyContent === 'center') {
      cellProps.style = { ...cellProps.style, textAlign: 'center' };
    }
  }

  if (height) {
    cellProps.style = { ...cellProps.style, height };
  }

  if (textWrapped) {
    cellProps.style = { ...cellProps.style, textWrap: 'wrap' };
  }

  const { key, ...rest } = cellProps;

  return (
    <div key={key} {...rest} className={cellStyle}>
      {hasLinks ? (
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
      ) : isStringValue ? (
        `${value}`
      ) : (
        <div className={tableStyles.cellText}>{value}</div>
      )}

      {showActions && <CellActions {...props} previewMode={TableCellInspectorMode.text} showFilters={showFilters} />}
    </div>
  );
};

function getCellStyle(
  tableStyles: TableStyles,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue,
  disableOverflowOnHover = false,
  isStringValue = false,
  shouldWrapText = false,
  textWrapped = false,
  rowStyled = false,
  rowExpanded = false
) {
  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;
  let bgHoverColor: string | undefined = undefined;

  // Get colors
  const colors = getCellColors(tableStyles, cellOptions, displayValue);
  textColor = colors.textColor;
  bgColor = colors.bgColor;
  bgHoverColor = colors.bgHoverColor;

  // If we have definied colors return those styles
  // Otherwise we return default styles
  return tableStyles.buildCellContainerStyle(
    textColor,
    bgColor,
    bgHoverColor,
    !disableOverflowOnHover,
    isStringValue,
    shouldWrapText,
    textWrapped,
    rowStyled,
    rowExpanded
  );
}

function getLinkStyle(tableStyles: TableStyles, cellOptions: TableCellOptions, targetClassName: string | undefined) {
  if (cellOptions.type === TableCellDisplayMode.Auto) {
    return cx(tableStyles.cellLink, targetClassName);
  }

  return cx(tableStyles.cellLinkForColoredCell, targetClassName);
}
