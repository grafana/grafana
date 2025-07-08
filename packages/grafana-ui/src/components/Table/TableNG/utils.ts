import { Property } from 'csstype';
import { SortColumn } from 'react-data-grid';
import tinycolor from 'tinycolor2';

import {
  FieldType,
  Field,
  formattedValueToString,
  GrafanaTheme2,
  DisplayValue,
  LinkModel,
  DisplayValueAlignmentFactors,
  DataFrame,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  TableCellHeight,
} from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../../utils/colors';
import { TableCellOptions } from '../types';

import { COLUMN, TABLE } from './constants';
import { CellColors, TableRow, TableFieldOptionsType, ColumnTypes, FrameToRowsConverter, Comparator } from './types';

/* ---------------------------- Cell calculations --------------------------- */
export type CellHeightCalculator = (text: string, cellWidth: number) => number;

/**
 * @internal
 * Returns the default row height based on the theme and cell height setting.
 */
export function getDefaultRowHeight(theme: GrafanaTheme2, cellHeight?: TableCellHeight): number {
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
 * @internal
 * Returns true if cell inspection (hover to see full content) is enabled for the field.
 */
export function isCellInspectEnabled(field: Field): boolean {
  return field.config?.custom?.inspect ?? false;
}

/**
 * @internal
 * Returns true if text wrapping should be applied to the cell.
 */
export function shouldTextWrap(field: Field): boolean {
  const cellOptions = getCellOptions(field);
  // @ts-ignore - a handful of cellTypes have boolean wrapText, but not all of them.
  // we should be very careful to only use boolean type for cellOptions.wrapText.
  // TBH we will probably move this up to a field option which is showIf rendered anyway,
  // but that'll be a migration to do, so it needs to happen post-GA.
  return Boolean(cellOptions?.wrapText);
}

// matches characters which CSS
const spaceRegex = /[\s-]/;

export interface GetMaxWrapCellOptions {
  colWidths: number[];
  avgCharWidth: number;
  wrappedColIdxs: boolean[];
}

/**
 * @internal
 * loop through the fields and their values, determine which cell is going to determine the
 * height of the row based on its content and width, and then return the text, index, and number of lines for that cell.
 */
export function getMaxWrapCell(
  fields: Field[],
  rowIdx: number,
  { colWidths, avgCharWidth, wrappedColIdxs }: GetMaxWrapCellOptions
): {
  text: string;
  idx: number;
  numLines: number;
} {
  let maxLines = 1;
  let maxLinesIdx = -1;
  let maxLinesText = '';

  // TODO: consider changing how we store this, using a record by column key instead of an array
  for (let i = 0; i < colWidths.length; i++) {
    if (wrappedColIdxs[i]) {
      const field = fields[i];
      // special case: for the header, provide `-1` as the row index.
      const cellTextRaw = rowIdx === -1 ? getDisplayName(field) : field.values[rowIdx];

      if (cellTextRaw != null) {
        const cellText = String(cellTextRaw);

        if (spaceRegex.test(cellText)) {
          const charsPerLine = colWidths[i] / avgCharWidth;
          const approxLines = cellText.length / charsPerLine;

          if (approxLines > maxLines) {
            maxLines = approxLines;
            maxLinesIdx = i;
            maxLinesText = cellText;
          }
        }
      }
    }
  }

  return { text: maxLinesText, idx: maxLinesIdx, numLines: maxLines };
}

/**
 * @internal
 * Returns true if text overflow handling should be applied to the cell.
 */
export function shouldTextOverflow(field: Field): boolean {
  return (
    field.type === FieldType.string &&
    // Tech debt: Technically image cells are of type string, which is misleading (kinda?)
    // so we need to ensure we don't apply overflow hover states for type image
    getCellOptions(field).type !== TableCellDisplayMode.Image &&
    !shouldTextWrap(field) &&
    !isCellInspectEnabled(field)
  );
}

/**
 * @internal
 * Returns the text alignment for a field based on its type and configuration.
 */
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

const DEFAULT_CELL_OPTIONS = { type: TableCellDisplayMode.Auto } as const;

/**
 * @internal
 * Returns the cell options for a field, migrating from legacy displayMode if necessary.
 */
export function getCellOptions(field: Field): TableCellOptions {
  if (field.config.custom?.displayMode) {
    return migrateTableDisplayModeToCellOptions(field.config.custom?.displayMode);
  }

  return field.config.custom?.cellOptions ?? DEFAULT_CELL_OPTIONS;
}

/**
 * @internal
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
      const nextDisplayValue = field.display?.(field.values[i]) ?? field.values[i];
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

/* ------------------------- Cell color calculation ------------------------- */
const CELL_COLOR_DARKENING_MULTIPLIER = 10;
const CELL_GRADIENT_DARKENING_MULTIPLIER = 15;
const CELL_GRADIENT_HUE_ROTATION_DEGREES = 5;

/**
 * @internal
 * Returns the text and background colors for a table cell based on its options and display value.
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

/**
 * @internal
 * Extracts numeric pixel value from theme spacing
 */
export const extractPixelValue = (spacing: string | number): number => {
  return typeof spacing === 'number' ? spacing : parseFloat(spacing) || 0;
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

      links[i].onClick = (event: MouseEvent) => {
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
/**
 * @internal
 */
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

/* ----------------------------- Data grid mapping ---------------------------- */
/**
 * @internal
 */
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
  // @ts-ignore The compared vals are DataFrameWithValue. the value is the rendered stat (first, last, etc.)
  return (a?.value ?? 0) - (b?.value ?? 0);
};

/**
 * @internal
 */
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

type TableCellGaugeDisplayModes =
  | TableCellDisplayMode.BasicGauge
  | TableCellDisplayMode.GradientGauge
  | TableCellDisplayMode.LcdGauge;
const TABLE_CELL_GAUGE_DISPLAY_MODES_TO_DISPLAY_MODES: Record<TableCellGaugeDisplayModes, BarGaugeDisplayMode> = {
  [TableCellDisplayMode.BasicGauge]: BarGaugeDisplayMode.Basic,
  [TableCellDisplayMode.GradientGauge]: BarGaugeDisplayMode.Gradient,
  [TableCellDisplayMode.LcdGauge]: BarGaugeDisplayMode.Lcd,
};

type TableCellColorBackgroundDisplayModes =
  | TableCellDisplayMode.ColorBackground
  | TableCellDisplayMode.ColorBackgroundSolid;
const TABLE_CELL_COLOR_BACKGROUND_DISPLAY_MODES_TO_DISPLAY_MODES: Record<
  TableCellColorBackgroundDisplayModes,
  TableCellBackgroundDisplayMode
> = {
  [TableCellDisplayMode.ColorBackground]: TableCellBackgroundDisplayMode.Gradient,
  [TableCellDisplayMode.ColorBackgroundSolid]: TableCellBackgroundDisplayMode.Basic,
};

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
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      return {
        type: TableCellDisplayMode.Gauge,
        mode: TABLE_CELL_GAUGE_DISPLAY_MODES_TO_DISPLAY_MODES[displayMode],
      };
    // Also true in the case of the color background
    case TableCellDisplayMode.ColorBackground:
    case TableCellDisplayMode.ColorBackgroundSolid:
      return {
        type: TableCellDisplayMode.ColorBackground,
        mode: TABLE_CELL_COLOR_BACKGROUND_DISPLAY_MODES_TO_DISPLAY_MODES[displayMode],
      };
    // catching a nonsense case: `displayMode`: 'custom' should pre-date the CustomCell.
    // if it doesn't, we need to just nope out and return an auto cell.
    case TableCellDisplayMode.Custom:
      return {
        type: TableCellDisplayMode.Auto,
      };
    default:
      return {
        type: displayMode,
      };
  }
}

/**
 * @internal
 * Returns true if the DataFrame contains nested frames
 */
export const getIsNestedTable = (fields: Field[]): boolean =>
  fields.some(({ type }) => type === FieldType.nestedFrames);

/**
 * @internal
 * Processes nested table rows
 */
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

/**
 * @internal
 * returns the display name of a field
 */
export const getDisplayName = (field: Field): string => {
  return field.state?.displayName ?? field.name;
};

/**
 * @internal
 * returns only fields that are not nested tables and not explicitly hidden
 */
export function getVisibleFields(fields: Field[]): Field[] {
  return fields.filter((field) => field.type !== FieldType.nestedFrames && field.config.custom?.hidden !== true);
}

/**
 * @internal
 * returns a map of column types by display name
 */
export function getColumnTypes(fields: Field[]): ColumnTypes {
  return fields.reduce<ColumnTypes>((acc, field) => {
    switch (field.type) {
      case FieldType.nestedFrames:
        return { ...acc, ...getColumnTypes(field.values[0]?.[0]?.fields ?? []) };
      default:
        return { ...acc, [getDisplayName(field)]: field.type };
    }
  }, {});
}

/**
 * @internal
 * calculates the width of each field, with the following logic:
 * 1. manual sizing minWidth is hard-coded to 50px, we set this in RDG since it enforces the hard limit correctly
 * 2. if minWidth is configured in fieldConfig (or defaults to 150), it serves as the bottom of the auto-size clamp
 */
export function computeColWidths(fields: Field[], availWidth: number) {
  let autoCount = 0;
  let definedWidth = 0;

  return (
    fields
      // first pass to add up how many fields have pre-defined widths and what that width totals to.
      .map((field) => {
        const width: number = field.config.custom?.width ?? 0;

        if (width === 0) {
          autoCount++;
        } else {
          definedWidth += width;
        }

        return width;
      })
      // second pass once `autoCount` and `definedWidth` are known.
      .map(
        (width, i) =>
          width ||
          Math.max(fields[i].config.custom?.minWidth ?? COLUMN.DEFAULT_WIDTH, (availWidth - definedWidth) / autoCount)
      )
  );
}

/**
 * @internal
 * if applyToRow is true in any field, return a function that gets the row background color
 */
export function getApplyToRowBgFn(fields: Field[], theme: GrafanaTheme2): ((rowIndex: number) => CellColors) | void {
  for (const field of fields) {
    const cellOptions = getCellOptions(field);
    const fieldDisplay = field.display;
    if (
      fieldDisplay !== undefined &&
      cellOptions.type === TableCellDisplayMode.ColorBackground &&
      cellOptions.applyToRow === true
    ) {
      return (rowIndex: number) => getCellColors(theme, cellOptions, fieldDisplay(field.values[rowIndex]));
    }
  }
}
