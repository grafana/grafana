import { type Property } from 'csstype';
import tinycolor from 'tinycolor2';

import {
  type ActionModel,
  type DisplayValue,
  type DisplayValueAlignmentFactors,
  type Field,
  FieldType,
  formattedValueToString,
  type GrafanaTheme2,
  type LinkModel,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  type TableAutoCellOptions,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
} from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../utils/colors';

import { type CellColors, type TableCellOptions, type TableFieldOptions } from './types';

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom: TableFieldOptions = field.config.custom;

    switch (custom.align) {
      case 'right':
        return 'flex-end';
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
    }
  }

  if (field.type === FieldType.number) {
    return 'flex-end';
  }

  return 'flex-start';
}

const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };

export function getCellOptions(field: Field): TableCellOptions {
  if (field.config.custom?.displayMode) {
    return migrateTableDisplayModeToCellOptions(field.config.custom?.displayMode);
  }

  if (!field.config.custom?.cellOptions) {
    return defaultCellOptions;
  }

  return field.config.custom.cellOptions;
}

/**
 * Migrates table cell display mode to new object format.
 *
 * @param displayMode The display mode of the cell
 * @returns TableCellOptions object in the correct format
 * relative to the old display mode.
 */
export function migrateTableDisplayModeToCellOptions(displayMode: TableCellDisplayMode): TableCellOptions {
  switch (displayMode) {
    // In the case of the gauge we move to a different option
    case 'basic':
    case 'gradient-gauge':
    case 'lcd-gauge':
      let gaugeMode = BarGaugeDisplayMode.Basic;

      if (displayMode === 'gradient-gauge') {
        gaugeMode = BarGaugeDisplayMode.Gradient;
      } else if (displayMode === 'lcd-gauge') {
        gaugeMode = BarGaugeDisplayMode.Lcd;
      }

      return {
        type: TableCellDisplayMode.Gauge,
        mode: gaugeMode,
      };
    // Also true in the case of the color background
    case 'color-background':
    case 'color-background-solid':
      let mode = TableCellBackgroundDisplayMode.Basic;

      // Set the new mode field, somewhat confusingly the
      // color-background mode is for gradient display
      if (displayMode === 'color-background') {
        mode = TableCellBackgroundDisplayMode.Gradient;
      }

      return {
        type: TableCellDisplayMode.ColorBackground,
        mode: mode,
      };
    default:
      // @ts-ignore TSGO / TS7
      return {
        // @ts-ignore TS5 / TS6
        type: displayMode,
      };
  }
}

/**
 * Getting gauge or sparkline values to align is very tricky without looking at all values and passing them through display processor.
 * For very large tables that could pretty expensive. So this is kind of a compromise. We look at the first 1000 rows and cache the longest value.
 * If we have a cached value we just check if the current value is longer and update the alignmentFactor. This can obviously still lead to
 * unaligned gauges but it should a lot less common.
 **/
export function getAlignmentFactor(
  field: Field,
  displayValue: DisplayValue,
  rowIndex: number
): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (formattedValueToString(alignmentFactor).length < formattedValueToString(displayValue).length) {
      alignmentFactor = { ...displayValue };
      field.state!.alignmentFactors = alignmentFactor;
    }
    return alignmentFactor;
  } else {
    // look at the next 1000 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display!(field.values[i]);
      if (formattedValueToString(alignmentFactor).length > formattedValueToString(nextDisplayValue).length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}

/**
 * Retrieve colors for a table cell (or table row).
 *
 * @param tableStyles
 *  Styles for the table
 * @param cellOptions
 *  Table cell configuration options
 * @param displayValue
 *  The value that will be displayed
 * @returns CellColors
 */
export function getCellColors(
  theme: GrafanaTheme2,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue
): CellColors {
  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = theme.isDark ? 1 : -0.7;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;
  let bgHoverColor: string | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
      bgHoverColor = tinycolor(displayValue.color).setAlpha(1).toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      const hoverColor = tinycolor(displayValue.color).setAlpha(1).toRgbString();
      const bgColor2 = tinycolor(displayValue.color)
        .darken(10 * darkeningFactor)
        .spin(5);
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
      bgHoverColor = `linear-gradient(120deg, ${bgColor2.setAlpha(1).toRgbString()}, ${hoverColor})`;
    }
  }

  return { textColor, bgColor, bgHoverColor };
}

export interface DataLinksActionsTooltipState {
  coords: DataLinksActionsTooltipCoords;
  links?: LinkModel[];
  actions?: ActionModel[];
}

export interface DataLinksActionsTooltipCoords {
  clientX: number;
  clientY: number;
}

export const getDataLinksActionsTooltipUtils = (links: LinkModel[], actions?: ActionModel[]) => {
  const hasMultipleLinksOrActions = links.length > 1 || Boolean(actions?.length);
  const shouldShowLink = links.length === 1 && !Boolean(actions?.length);

  return { shouldShowLink, hasMultipleLinksOrActions };
};

const shouldTriggerTooltip = (event: React.MouseEvent<HTMLElement>): boolean => {
  return event.target === event.currentTarget;
};

/**
 * Creates an onClick handler for table cells that only triggers tooltip when clicking directly on the cell
 * @param setTooltipCoords - function to set tooltip coordinates
 * @returns onClick handler
 */
export const tooltipOnClickHandler = (setTooltipCoords: (coords: DataLinksActionsTooltipCoords) => void) => {
  return (event: React.MouseEvent<HTMLElement>) => {
    if (shouldTriggerTooltip(event)) {
      const { clientX, clientY } = event;
      setTooltipCoords({ clientX, clientY });
    }
  };
};
