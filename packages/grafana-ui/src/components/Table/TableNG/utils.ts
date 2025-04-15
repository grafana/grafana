import { css } from '@emotion/css';
import { Property } from 'csstype';
import React from 'react';
import { SortColumn, SortDirection } from 'react-data-grid';
import tinycolor from 'tinycolor2';
import { varPreLine } from 'uwrap';

import {
  FieldType,
  Field,
  formattedValueToString,
  reduceField,
  GrafanaTheme2,
  DisplayValue,
  LinkModel,
  DisplayValueAlignmentFactors,
  DataFrame,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableAutoCellOptions,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  TableCellHeight,
  TableCellOptions,
  TableSortByFieldState,
} from '@grafana/schema';

import { TableCellInspectorMode } from '../..';
import { getTextColorForAlphaBackground } from '../../../utils';

import { TABLE } from './constants';
import {
  CellColors,
  TableRow,
  TableFieldOptionsType,
  ColumnTypes,
  FilterType,
  FrameToRowsConverter,
  TableNGProps,
  Comparator,
  TableFooterCalc,
} from './types';

/* ---------------------------- Cell calculations --------------------------- */
export function getCellHeight(
  text: string,
  cellWidth: number, // width of the cell without padding
  ctx: CanvasRenderingContext2D,
  lineHeight: number,
  defaultRowHeight: number,
  padding = 0
) {
  const PADDING = padding * 2;

  if (typeof text === 'string') {
    const words = text.split(/\s/);
    const lines = [];
    let currentLine = '';

    // Let's just wrap the lines and see how well the measurement works
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      // TODO: this method is not accurate
      let lineWidth = ctx.measureText(currentLine + ' ' + currentWord).width;

      // if line width is less than the cell width, add the word to the current line and continue
      // else add the current line to the lines array and start a new line with the current word
      if (lineWidth < cellWidth) {
        currentLine += ' ' + currentWord;
      } else {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });

        currentLine = currentWord;
      }

      // if we are at the last word, add the current line to the lines array
      if (i === words.length - 1) {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });
      }
    }

    if (lines.length === 1) {
      return defaultRowHeight;
    }

    // TODO: double padding to adjust osContext.measureText() results
    const height = lines.length * lineHeight + PADDING * 2;

    return height;
  }

  return defaultRowHeight;
}

export type CellHeightCalculator = (text: string, cellWidth: number) => number;

export function getCellHeightCalculator(
  // should be pre-configured with font and letterSpacing
  ctx: CanvasRenderingContext2D,
  lineHeight: number,
  defaultRowHeight: number,
  padding = 0
) {
  const { count } = varPreLine(ctx);

  return (text: string, cellWidth: number) => {
    const effectiveCellWidth = Math.max(cellWidth, 20); // Minimum width to work with
    const TOTAL_PADDING = padding * 2;
    const numLines = count(text, effectiveCellWidth);
    const totalHeight = numLines * lineHeight + TOTAL_PADDING;
    return Math.max(totalHeight, defaultRowHeight);
  };
}

export function getDefaultRowHeight(theme: GrafanaTheme2, cellHeight: TableCellHeight | undefined): number {
  const bodyFontSize = theme.typography.fontSize;
  const lineHeight = theme.typography.body.lineHeight;

  switch (cellHeight) {
    case TableCellHeight.Sm:
      return 36;
    case TableCellHeight.Md:
      return 42;
    case TableCellHeight.Lg:
      return TABLE.MAX_CELL_HEIGHT;
  }

  return TABLE.CELL_PADDING * 2 + bodyFontSize * lineHeight;
}

/**
 * getRowHeight determines cell height based on cell width + text length. Used
 * for when textWrap is enabled.
 */
export function getRowHeight(
  row: TableRow,
  calc: CellHeightCalculator,
  avgCharWidth: number,
  defaultRowHeight: number,
  fieldsData: {
    headersLength: number;
    textWraps: { [key: string]: boolean };
    columnTypes: ColumnTypes;
    columnWidths: Record<string, number>;
    fieldDisplayType: Record<string, TableCellDisplayMode>;
  }
): number {
  let maxLines = 1;
  let maxLinesCol = '';

  for (const key in row) {
    if (
      fieldsData.columnTypes[key] === FieldType.string &&
      fieldsData.textWraps[key] &&
      fieldsData.fieldDisplayType[key] !== TableCellDisplayMode.Image
    ) {
      const cellText = row[key] as string;

      if (cellText != null) {
        const charsPerLine = fieldsData.columnWidths[key] / avgCharWidth;
        const approxLines = cellText.length / charsPerLine;

        if (approxLines > maxLines) {
          maxLines = approxLines;
          maxLinesCol = key;
        }
      }
    }
  }

  return maxLinesCol === '' ? defaultRowHeight : calc(row[maxLinesCol] as string, fieldsData.columnWidths[maxLinesCol]);
}

export function isTextCell(key: string, columnTypes: Record<string, string>): boolean {
  return columnTypes[key] === FieldType.string;
}

export function shouldTextOverflow(
  key: string,
  row: TableRow,
  columnTypes: ColumnTypes,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  ctx: CanvasRenderingContext2D,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number,
  textWrap: boolean,
  field: Field,
  cellType: TableCellDisplayMode
): boolean {
  const cellInspect = field.config?.custom?.inspect ?? false;

  // Tech debt: Technically image cells are of type string, which is misleading (kinda?)
  // so we need to ensure we don't apply overflow hover states fo type image
  if (textWrap || cellInspect || cellType === TableCellDisplayMode.Image || !isTextCell(key, columnTypes)) {
    return false;
  }

  return true;
}

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom: TableFieldOptionsType = field.config.custom;

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

/* ------------------------------ Footer calculations ------------------------------ */
export function getFooterItemNG(rows: TableRow[], field: Field, options: TableFooterCalc | undefined): string {
  if (options === undefined) {
    return '';
  }

  if (field.type !== FieldType.number) {
    return '';
  }

  // Check if reducer array exists and has at least one element
  if (!options.reducer || !options.reducer.length) {
    return '';
  }

  // If fields array is specified, only show footer for fields included in that array
  if (options.fields && options.fields.length > 0) {
    if (!options.fields.includes(field.name)) {
      return '';
    }
  }

  const calc = options.reducer[0];
  const value = reduceField({
    field: {
      ...field,
      values: rows.map((row) => row[field.name]),
    },
    reducers: options.reducer,
  })[calc];

  const formattedValue = formattedValueToString(field.display!(value));

  return formattedValue;
}

export const getFooterStyles = (justifyContent: Property.JustifyContent) => ({
  footerCell: css({
    display: 'flex',
    justifyContent: justifyContent || 'space-between',
  }),
});

/* ------------------------- Cell color calculation ------------------------- */
const CELL_COLOR_DARKENING_MULTIPLIER = 10;
const CELL_GRADIENT_DARKENING_MULTIPLIER = 15;
const CELL_GRADIENT_HUE_ROTATION_DEGREES = 5;

export function getCellColors(
  theme: GrafanaTheme2,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue
): CellColors {
  // Convert RGBA hover color to hex to prevent transparency issues on cell hover
  const autoCellBackgroundHoverColor = convertRGBAToHex(theme.colors.background.primary, theme.colors.action.hover);

  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = theme.isDark ? 1 : -0.7;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;
  let bgHoverColor: string = autoCellBackgroundHoverColor;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
      bgHoverColor = tinycolor(displayValue.color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      const hoverColor = tinycolor(displayValue.color)
        .darken(CELL_GRADIENT_DARKENING_MULTIPLIER * darkeningFactor)
        .toRgbString();
      const bgColor2 = tinycolor(displayValue.color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .spin(CELL_GRADIENT_HUE_ROTATION_DEGREES);
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
      bgHoverColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${hoverColor})`;
    }
  }

  return { textColor, bgColor, bgHoverColor };
}

/** Extracts numeric pixel value from theme spacing */
export const extractPixelValue = (spacing: string | number): number => {
  return typeof spacing === 'number' ? spacing : parseFloat(spacing) || 0;
};

/** Converts an RGBA color to hex by blending it with a background color */
export const convertRGBAToHex = (backgroundColor: string, rgbaColor: string): string => {
  const bg = tinycolor(backgroundColor);
  const rgba = tinycolor(rgbaColor);
  return tinycolor.mix(bg, rgba, rgba.getAlpha() * 100).toHexString();
};

/* ------------------------------- Data links ------------------------------- */
/**
 * @internal
 */
export const getCellLinks = (field: Field, rowIdx: number) => {
  let links: Array<LinkModel<unknown>> | undefined;
  if (field.getLinks) {
    links = field.getLinks({
      valueRowIndex: rowIdx,
    });
  }

  if (!links) {
    return;
  }

  for (let i = 0; i < links?.length; i++) {
    if (links[i].onClick) {
      const origOnClick = links[i].onClick;

      links[i].onClick = (event) => {
        // Allow opening in new tab
        if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
          event.preventDefault();
          origOnClick!(event, {
            field,
            rowIndex: rowIdx,
          });
        }
      };
    }
  }

  return links;
};

/* ----------------------------- Data grid sorting ---------------------------- */
export const handleSort = (
  columnKey: string,
  direction: SortDirection,
  isMultiSort: boolean,
  setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>,
  sortColumnsRef: React.MutableRefObject<readonly SortColumn[]>
) => {
  let currentSortColumn: SortColumn | undefined;

  const updatedSortColumns = sortColumnsRef.current.filter((column) => {
    const isCurrentColumn = column.columnKey === columnKey;
    if (isCurrentColumn) {
      currentSortColumn = column;
    }
    return !isCurrentColumn;
  });

  // sorted column exists and is descending -> remove it to reset sorting
  if (currentSortColumn && currentSortColumn.direction === 'DESC') {
    setSortColumns(updatedSortColumns);
    sortColumnsRef.current = updatedSortColumns;
  } else {
    // new sort column or changed direction
    if (isMultiSort) {
      setSortColumns([...updatedSortColumns, { columnKey, direction }]);
      sortColumnsRef.current = [...updatedSortColumns, { columnKey, direction }];
    } else {
      setSortColumns([{ columnKey, direction }]);
      sortColumnsRef.current = [{ columnKey, direction }];
    }
  }
};

/* ----------------------------- Data grid mapping ---------------------------- */
export const frameToRecords = (frame: DataFrame): TableRow[] => {
  const fnBody = `
    const rows = Array(frame.length);
    const values = frame.fields.map(f => f.values);
    let rowCount = 0;
    for (let i = 0; i < frame.length; i++) {
      rows[rowCount] = {
        __depth: 0,
        __index: i,
        ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(field.name)}: values[${fieldIdx}][i]`).join(',')}
      };
      rowCount += 1;
      if (rows[rowCount-1]['Nested frames']){
        const childFrame = rows[rowCount-1]['Nested frames'];
        rows[rowCount] = {__depth: 1, __index: i, data: childFrame[0]}
        rowCount += 1;
      }
    }
    return rows;
  `;

  // Creates a function that converts a DataFrame into an array of TableRows
  // Uses new Function() for performance as it's faster than creating rows using loops
  const convert = new Function('frame', fnBody) as unknown as FrameToRowsConverter;
  return convert(frame);
};

export interface MapFrameToGridOptions extends TableNGProps {
  columnTypes: ColumnTypes;
  columnWidth: number | string;
  crossFilterOrder: React.MutableRefObject<string[]>;
  crossFilterRows: React.MutableRefObject<{ [key: string]: TableRow[] }>;
  defaultLineHeight: number;
  defaultRowHeight: number;
  expandedRows: number[];
  filter: FilterType;
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>;
  isCountRowsSet: boolean;
  ctx: CanvasRenderingContext2D;
  onSortByChange?: (sortBy: TableSortByFieldState[]) => void;
  rows: TableRow[];
  sortedRows: TableRow[];
  setContextMenuProps: (props: { value: string; top?: number; left?: number; mode?: TableCellInspectorMode }) => void;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  setIsInspecting: (isInspecting: boolean) => void;
  setSortColumns: React.Dispatch<React.SetStateAction<readonly SortColumn[]>>;
  sortColumnsRef: React.MutableRefObject<readonly SortColumn[]>;
  styles: { cell: string; cellWrapped: string; dataGrid: string };
  textWraps: Record<string, boolean>;
  theme: GrafanaTheme2;
  showTypeIcons?: boolean;
}

/* ----------------------------- Data grid comparator ---------------------------- */
// The numeric: true option is used to sort numbers as strings correctly. It recognizes numeric sequences
// within strings and sorts numerically instead of lexicographically.
const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;
export function getComparator(sortColumnType: FieldType): Comparator {
  switch (sortColumnType) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return (a, b) => {
        if (a === b) {
          return 0;
        }
        if (a == null) {
          return -1;
        }
        if (b == null) {
          return 1;
        }
        return Number(a) - Number(b);
      };
    case FieldType.string:
    case FieldType.enum:
    default:
      return (a, b) => compare(String(a ?? ''), String(b ?? ''));
  }
}

/* ---------------------------- Miscellaneous ---------------------------- */
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
      return {
        // @ts-ignore
        type: displayMode,
      };
  }
}

/** Returns true if the DataFrame contains nested frames */
export const getIsNestedTable = (dataFrame: DataFrame): boolean =>
  dataFrame.fields.some(({ type }) => type === FieldType.nestedFrames);
