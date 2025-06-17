import { Property } from 'csstype';
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
} from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../../utils/colors';

import { COLUMN, TABLE } from './constants';
import {
  CellColors,
  TableRow,
  TableFieldOptionsType,
  ColumnTypes,
  FrameToRowsConverter,
  Comparator,
  TableFooterCalc,
} from './types';

/* ---------------------------- Cell calculations --------------------------- */
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
    const numLines = count(text, cellWidth);
    const totalHeight = numLines * lineHeight + 2 * padding;
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

export function shouldTextOverflow(
  key: string,
  columnTypes: ColumnTypes,
  textWrap: boolean,
  field: Field,
  cellType: TableCellDisplayMode
): boolean {
  const cellInspect = field.config?.custom?.inspect ?? false;

  // Tech debt: Technically image cells are of type string, which is misleading (kinda?)
  // so we need to ensure we don't apply overflow hover states fo type image
  if (textWrap || cellInspect || cellType === TableCellDisplayMode.Image || columnTypes[key] === FieldType.string) {
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
export function getFooterItem(rows: TableRow[], field: Field, options: TableFooterCalc | undefined): string {
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
    if (!options.fields.includes(getDisplayName(field))) {
      return '';
    }
  }

  const calc = options.reducer[0];
  const value = reduceField({
    field: {
      ...field,
      values: rows.map((row) => row[getDisplayName(field)]),
    },
    reducers: options.reducer,
  })[calc];

  const formattedValue = formattedValueToString(field.display!(value));

  return formattedValue;
}

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

  return links.filter((link) => link.href || link.onClick != null);
};

/* ----------------------------- Data grid sorting ---------------------------- */
export const updateSortColumns = (
  columnKey: string,
  direction: SortDirection,
  isMultiSort: boolean,
  sortColumns: SortColumn[]
): SortColumn[] => {
  let currentSortColumn: SortColumn | undefined;

  const updatedSortColumns = sortColumns.filter((column) => {
    const isCurrentColumn = column.columnKey === columnKey;
    if (isCurrentColumn) {
      currentSortColumn = column;
    }
    return !isCurrentColumn;
  });

  // sorted column exists and is descending -> remove it to reset sorting
  if (currentSortColumn && currentSortColumn.direction === 'DESC') {
    return updatedSortColumns;
  }

  // new sort column or changed direction
  if (isMultiSort) {
    return [...updatedSortColumns, { columnKey, direction }];
  }

  return [{ columnKey, direction }];
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
        ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(getDisplayName(field))}: values[${fieldIdx}][i]`).join(',')}
      };
      rowCount += 1;
      if (rows[rowCount-1]['__nestedFrames']){
        const childFrame = rows[rowCount-1]['__nestedFrames'];
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

/* ----------------------------- Data grid comparator ---------------------------- */
// The numeric: true option is used to sort numbers as strings correctly. It recognizes numeric sequences
// within strings and sorts numerically instead of lexicographically.
const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;
const strCompare: Comparator = (a, b) => compare(String(a ?? ''), String(b ?? ''));
const numCompare: Comparator = (a, b) => {
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
const frameCompare: Comparator = (a, b) => {
  // @ts-ignore The values are DataFrameWithValue
  return (a?.value ?? 0) - (b?.value ?? 0);
};

export function getComparator(sortColumnType: FieldType): Comparator {
  switch (sortColumnType) {
    // Handle sorting for frame type fields (sparklines)
    case FieldType.frame:
      return frameCompare;
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return numCompare;
    case FieldType.string:
    case FieldType.enum:
    default:
      return strCompare;
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
export const getIsNestedTable = (fields: Field[]): boolean =>
  fields.some(({ type }) => type === FieldType.nestedFrames);

/** Processes nested table rows */
export const processNestedTableRows = (
  rows: TableRow[],
  processParents: (parents: TableRow[]) => TableRow[]
): TableRow[] => {
  // Separate parent and child rows
  // Array for parentRows: enables sorting and maintains order for iteration
  // Map for childRows: provides O(1) lookup by parent index when reconstructing the result
  const parentRows: TableRow[] = [];
  const childRows: Map<number, TableRow> = new Map();

  for (const row of rows) {
    if (Number(row.__depth) === 0) {
      parentRows.push(row);
    } else {
      childRows.set(Number(row.__index), row);
    }
  }

  // Process parent rows (filter or sort)
  const processedParents = processParents(parentRows);

  // Reconstruct the result
  const result: TableRow[] = [];
  processedParents.forEach((row) => {
    result.push(row);
    const childRow = childRows.get(Number(row.__index));
    if (childRow) {
      result.push(childRow);
    }
  });

  return result;
};

export const getDisplayName = (field: Field): string => {
  return field.state?.displayName ?? field.name;
};

export function getVisibleFields(fields: Field[]): Field[] {
  return fields.filter((field) => field.type !== FieldType.nestedFrames && field.config.custom?.hidden !== true);
}

export function getColumnTypes(fields: Field[]): ColumnTypes {
  return fields.reduce<ColumnTypes>((acc, field) => {
    switch (field.type) {
      case FieldType.nestedFrames:
        const nestedFields: Field[] = field.values[0]?.[0]?.fields ?? [];
        if (!nestedFields) {
          return acc;
        }
        return { ...acc, ...getColumnTypes(nestedFields) };
      default:
        return { ...acc, [getDisplayName(field)]: field.type };
    }
  }, {});
}

export function applySort(
  rows: TableRow[],
  fields: Field[],
  sortColumns: SortColumn[],
  columnTypes: ColumnTypes = getColumnTypes(fields),
  hasNestedFrames: boolean = getIsNestedTable(fields)
): TableRow[] {
  if (sortColumns.length === 0) {
    return rows;
  }

  const compareRows = (a: TableRow, b: TableRow): number => {
    let result = 0;
    for (let i = 0; i < sortColumns.length; i++) {
      const { columnKey, direction } = sortColumns[i];
      const compare = getComparator(columnTypes[columnKey]);
      const sortDir = direction === 'ASC' ? 1 : -1;

      result = sortDir * compare(a[columnKey], b[columnKey]);
      if (result !== 0) {
        break;
      }
    }
    return result;
  };

  // Handle nested tables
  if (hasNestedFrames) {
    return processNestedTableRows(rows, (parents) => [...parents].sort(compareRows));
  }

  // Regular sort for tables without nesting
  return [...rows].sort(compareRows);
}

// 1. manual sizing minWidth is hard-coded to 50px, we set this in RDG since it enforces the hard limit correctly
// 2. if minWidth is configured in fieldConfig (or defaults to 150), it serves as the bottom of the auto-size clamp
export function computeColWidths(fields: Field[], availWidth: number) {
  let autoCount = 0;
  let definedWidth = 0;

  return fields
    .map((field, i) => {
      const width: number = field.config.custom?.width ?? 0;

      if (width === 0) {
        autoCount++;
      } else {
        definedWidth += width;
      }

      return width;
    })
    .map(
      (width, i) =>
        width ||
        Math.max(fields[i].config.custom?.minWidth ?? COLUMN.DEFAULT_WIDTH, (availWidth - definedWidth) / autoCount)
    );
}

export function getRowBgFn(fields: Field[], theme: GrafanaTheme2): ((rowIndex: number) => CellColors) | void {
  for (const field of fields) {
    const cellOptions: TableCellOptions | void = field.config.custom?.cellOptions;
    const fieldDisplay = field.display;
    if (
      fieldDisplay !== undefined &&
      cellOptions !== undefined &&
      cellOptions.type === TableCellDisplayMode.ColorBackground &&
      cellOptions.applyToRow === true
    ) {
      return (rowIndex: number) => getCellColors(theme, cellOptions, fieldDisplay(field.values[rowIndex]));
    }
  }
}

/**
 * - getCellHeightCalculator
 * - getAlignmentFactor:  alignmentFactor.text = displayValue.text;
 * - getFooterItem: If fields array is specified, only show footer for fields included in that array
 * - getCellLinks: on click
 * - frameCompare, and getComparator return frameCompare
 * - migrateTableDisplayModeToCellOptions: LCD gauge mode
 * - getRowBgFn
 */
