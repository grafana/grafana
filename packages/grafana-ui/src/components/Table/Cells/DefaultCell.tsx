import { ReactElement, useState } from 'react';
import * as React from 'react';

import { DisplayValue, formattedValueToString } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { getCellLinks } from '../../../utils/table';
import { CellActions } from '../CellActions';
import { DataLinksActionsTooltip, renderSingleLink } from '../DataLinksActionsTooltip';
import { TableCellInspectorMode } from '../TableCellInspector';
import { TableStyles } from '../TableRT/styles';
import { TableCellProps, CustomCellRendererProps, TableCellOptions } from '../types';
import {
  DataLinksActionsTooltipCoords,
  getCellColors,
  getCellOptions,
  getDataLinksActionsTooltipUtils,
  tooltipOnClickHandler,
} from '../utils';

export const DefaultCell = (props: TableCellProps) => {
  const { field, cell, tableStyles, row, cellProps, frame, rowStyled, rowExpanded, textWrapped, height } = props;
  const inspectEnabled = Boolean(field.config.custom?.inspect);
  const displayValue = field.display!(cell.value);

  const showFilters = props.onCellFilterAdded && field.config.filterable;
  const showActions = (showFilters && cell.value !== undefined) || inspectEnabled;
  const cellOptions = getCellOptions(field);
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
  const links = getCellLinks(field, row) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      key={key}
      {...rest}
      className={cellStyle}
      style={{ ...cellProps.style, cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={tooltipOnClickHandler(setTooltipCoords)}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], value, getLinkStyle(tableStyles, cellOptions))
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          value={value}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : isStringValue ? (
        `${value}`
      ) : (
        <div className={tableStyles.cellText}>{value}</div>
      )}

      {showActions && <CellActions {...props} previewMode={TableCellInspectorMode.text} showFilters={showFilters} />}
    </div>
  );
};

const getLinkStyle = (tableStyles: TableStyles, cellOptions: TableCellOptions) => {
  if (cellOptions.type === TableCellDisplayMode.Auto) {
    return tableStyles.cellLink;
  }

  return tableStyles.cellLinkForColoredCell;
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
  const colors = getCellColors(tableStyles.theme, cellOptions, displayValue);
  textColor = colors.textColor;
  bgColor = colors.bgColor;
  bgHoverColor = colors.bgHoverColor;

  // If we have defined colors return those styles
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
