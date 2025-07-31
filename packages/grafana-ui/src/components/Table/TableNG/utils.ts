import { Property } from 'csstype';
import { SortColumn } from 'react-data-grid';
import tinycolor from 'tinycolor2';
import { Count, varPreLine } from 'uwrap';

import {
  FieldType,
  Field,
  formattedValueToString,
  GrafanaTheme2,
  DisplayValue,
  LinkModel,
  DisplayValueAlignmentFactors,
  DataFrame,
  DisplayProcessor,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  FieldTextAlignment,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
  TableCellHeight,
} from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../../utils/colors';
import { TableCellOptions } from '../types';

import { inferPills } from './Cells/PillCell';
import { COLUMN, TABLE } from './constants';
import {
  CellColors,
  TableRow,
  ColumnTypes,
  FrameToRowsConverter,
  Comparator,
  TypographyCtx,
  LineCounter,
  LineCounterEntry,
} from './types';

/* ---------------------------- Cell calculations --------------------------- */
export type CellNumLinesCalculator = (text: string, cellWidth: number) => number;

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

/**
 * @internal creates a typography context based on a font size and family. used to measure text
 * and estimate size of text in cells.
 */
export function createTypographyContext(fontSize: number, fontFamily: string, letterSpacing = 0.15): TypographyCtx {
  const font = `${fontSize}px ${fontFamily}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  ctx.letterSpacing = `${letterSpacing}px`;
  ctx.font = font;
  // 1/6 of the characters in this string are capitalized. Since the avgCharWidth is used for estimation, it's
  // better that the estimation over-estimates the width than if it underestimates it, so we're a little on the
  // aggressive side here and could even go more aggressive if we get complaints in the future.
  const txt =
    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s. 1234567890 ALL CAPS TO HELP WITH MEASUREMENT.";
  const txtWidth = ctx.measureText(txt).width;
  const avgCharWidth = txtWidth / txt.length + letterSpacing;
  const { count } = varPreLine(ctx);

  return {
    ctx,
    fontFamily,
    letterSpacing,
    avgCharWidth,
    estimateLines: getTextLineEstimator(avgCharWidth),
    wrappedCount: wrapUwrapCount(count),
  };
}

/**
 * @internal wraps the uwrap count function to ensure that it is given a string.
 */
export function wrapUwrapCount(count: Count): LineCounter {
  return (value, width) => {
    if (value == null) {
      return 1;
    }

    return count(String(value), width);
  };
}

/**
 * @internal returns a line counter which guesstimates a number of lines in a text cell based on the typography context's avgCharWidth.
 */
export function getTextLineEstimator(avgCharWidth: number): LineCounter {
  return (value, width) => {
    if (!value) {
      return -1;
    }

    // we don't have string breaking enabled in the table,
    // so an unbroken string is by definition a single line.
    const strValue = String(value);
    if (!spaceRegex.test(strValue)) {
      return -1;
    }

    const charsPerLine = width / avgCharWidth;
    return strValue.length / charsPerLine;
  };
}

/**
 * @internal
 */
export function getDataLinksCounter(): LineCounter {
  const linksCountCache: Record<string, number> = {};

  // when we render links, we need to filter out the invalid links. since the call to `getLinks` is expensive,
  // we'll cache the result and reuse it for every row in the table. this cache is cleared when line counts are
  // rebuilt anytime from the `useRowHeight` hook, and that includes adding and removing data links.
  return (_value, _width, field, rowIdx) => {
    const cacheKey = getDisplayName(field);
    if (linksCountCache[cacheKey] === undefined) {
      linksCountCache[cacheKey] = getCellLinks(field, rowIdx)?.length ?? 0;
    }

    return linksCountCache[cacheKey];
  };
}

const PILLS_FONT_SIZE = 12;
const PILLS_SPACING = 12; // 6px horizontal padding on each side
const PILLS_GAP = 4; // gap between pills

export function getPillLineCounter(measureWidth: (value: string) => number): LineCounter {
  const widthCache: Record<string, number> = {};

  return (value, width) => {
    if (value == null) {
      return 0;
    }

    const pillValues = inferPills(String(value));
    if (pillValues.length === 0) {
      return 0;
    }

    let lines = 0;
    let currentLineUse = width;

    for (const pillValue of pillValues) {
      let rawWidth = widthCache[pillValue];
      if (rawWidth === undefined) {
        rawWidth = measureWidth(pillValue);
        widthCache[pillValue] = rawWidth;
      }
      const pillWidth = rawWidth + PILLS_SPACING;

      if (currentLineUse + pillWidth + PILLS_GAP > width) {
        lines++;
        currentLineUse = pillWidth;
      } else {
        currentLineUse += pillWidth + PILLS_GAP;
      }
    }

    return lines;
  };
}

/**
 * @internal return a text line counter for every field which has wrapHeaderText enabled.
 */
export function buildHeaderLineCounters(fields: Field[], typographyCtx: TypographyCtx): LineCounterEntry[] | undefined {
  const wrappedColIdxs = fields.reduce((acc: number[], field, idx) => {
    if (field.config?.custom?.wrapHeaderText) {
      acc.push(idx);
    }
    return acc;
  }, []);

  if (wrappedColIdxs.length === 0) {
    return undefined;
  }

  // don't bother with estimating the line counts for the headers, because it's punishing
  // when we get it wrong and there won't be that many compared to how many rows a table might contain.
  return [{ counter: typographyCtx.wrappedCount, fieldIdxs: wrappedColIdxs }];
}

const spaceRegex = /[\s-]/;

/**
 * @internal return a text line counter for every field which has wrapHeaderText enabled. we do this once as we're rendering
 * the table, and then getRowHeight uses the output of this to caluclate the height of each row.
 */
export function buildRowLineCounters(fields: Field[], typographyCtx: TypographyCtx): LineCounterEntry[] | undefined {
  const result: Record<string, LineCounterEntry> = {};
  let wrappedFields = 0;

  for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
    const field = fields[fieldIdx];
    if (shouldTextWrap(field)) {
      wrappedFields++;

      const cellType = getCellOptions(field).type;
      if (cellType === TableCellDisplayMode.DataLinks) {
        result.dataLinksCounter = result.dataLinksCounter ?? {
          counter: getDataLinksCounter(),
          fieldIdxs: [],
        };
        result.dataLinksCounter.fieldIdxs.push(fieldIdx);
      } else if (cellType === TableCellDisplayMode.Pill) {
        if (!result.pillCounter) {
          const pillTypographyCtx = createTypographyContext(
            PILLS_FONT_SIZE,
            typographyCtx.fontFamily,
            typographyCtx.letterSpacing
          );

          result.pillCounter = {
            estimate: getPillLineCounter((value) => value.length * pillTypographyCtx.avgCharWidth),
            counter: getPillLineCounter((value) => pillTypographyCtx.ctx.measureText(value).width),
            fieldIdxs: [],
          };
        }
        result.pillCounter.fieldIdxs.push(fieldIdx);
      }

      // for string fields, we estimate the length of a line using `avgCharWidth` to limit expensive calls `count`.
      else if (field.type === FieldType.string) {
        result.textCounter = result.textCounter ?? {
          counter: typographyCtx.wrappedCount,
          estimate: typographyCtx.estimateLines,
          fieldIdxs: [],
        };
        result.textCounter.fieldIdxs.push(fieldIdx);
      }
    }
  }

  if (wrappedFields === 0) {
    return undefined;
  }

  return Object.values(result);
}

// in some cases, the estimator might return a value that is less than 1, but when measured by the counter, it actually
// realizes that it's a multi-line cell. to avoid this, we want to give a little buffer away from 1 before we fully trust
// the estimator to have told us that a cell is single-line.
export const SINGLE_LINE_ESTIMATE_THRESHOLD = 0.85;

/**
 * @internal
 * loop through the fields and their values, determine which cell is going to determine the height of the row based
 * on its content and width, and return the height in pixels of that row, with vertial padding applied.
 */
export function getRowHeight(
  fields: Field[],
  rowIdx: number,
  columnWidths: number[],
  defaultHeight: number,
  lineCounters?: LineCounterEntry[],
  lineHeight = TABLE.LINE_HEIGHT,
  // when this is a function, the field which was measured as the maximum size will be returned, as well as the
  // calculated number of lines, so that the consumer can use it in case the vertical padding value differs field-by-field.
  verticalPadding: number | ((field: Field, numLines: number) => number) = TABLE.CELL_PADDING
): number {
  if (!lineCounters?.length) {
    return defaultHeight;
  }

  let maxLines = -1;
  let maxValue = '';
  let maxWidth = 0;
  let maxField: Field | undefined;
  let preciseCounter: LineCounter | undefined;

  for (const { estimate, counter, fieldIdxs } of lineCounters) {
    // for some of the line counters, getting the precise count of the lines is expensive. those line counters
    // set both an "estimate" and a "counter" function. if the cell we find to be the max was estimated, we will
    // get the "true" value right before calculating the row height by hanging onto a reference to the counter fn.
    const count = estimate ?? counter;
    const isEstimating = estimate !== undefined;

    for (const fieldIdx of fieldIdxs) {
      const field = fields[fieldIdx];
      // special case: for the header, provide `-1` as the row index.
      const cellValueRaw = rowIdx === -1 ? getDisplayName(field) : field.values[rowIdx];
      if (cellValueRaw != null) {
        const colWidth = columnWidths[fieldIdx];
        const approxLines = count(cellValueRaw, colWidth, field, rowIdx);
        if (approxLines > maxLines) {
          maxLines = approxLines;
          maxValue = cellValueRaw;
          maxWidth = colWidth;
          maxField = field;
          preciseCounter = isEstimating ? counter : undefined;
        }
      }
    }
  }

  // if the value is -1 or the estimate for the max cell was less than the SINGLE_LINE_ESTIMATE_THRESHOLD, we trust
  // that the estimator correctly identified that no text wrapping is needed for this row, skipping the preciseCounter.
  if (maxField === undefined || maxLines < SINGLE_LINE_ESTIMATE_THRESHOLD) {
    return defaultHeight;
  }

  // if we finished this row height loop with an estimate, we need to call
  // the `preciseCounter` method to get the exact line count.
  if (preciseCounter !== undefined) {
    maxLines = preciseCounter(maxValue, maxWidth, maxField, rowIdx);
  }

  // round up to the nearest line before doing math
  maxLines = Math.ceil(maxLines);

  // adjust for vertical padding and line height, and clamp to a minimum default height
  const verticalPaddingValue =
    typeof verticalPadding === 'function' ? verticalPadding(maxField, maxLines) : verticalPadding;
  const totalHeight = maxLines * lineHeight + verticalPaddingValue;
  return Math.max(totalHeight, defaultHeight);
}

/**
 * @internal
 * Returns true if text overflow handling should be applied to the cell.
 */
export function shouldTextOverflow(field: Field): boolean {
  const cellOptions = getCellOptions(field);
  const eligibleCellType =
    // Tech debt: Technically image cells are of type string, which is misleading (kinda?)
    // so we need to ensurefield.type === FieldType.string we don't apply overflow hover states for type image
    (field.type === FieldType.string && cellOptions.type !== TableCellDisplayMode.Image) ||
    // regardless of the underlying cell type, data links cells have text overflow.
    cellOptions.type === TableCellDisplayMode.DataLinks;

  return eligibleCellType && !shouldTextWrap(field) && !isCellInspectEnabled(field);
}

// we only want to infer justifyContent and textAlign for these cellTypes
const TEXT_CELL_TYPES = new Set<TableCellDisplayMode>([
  TableCellDisplayMode.Auto,
  TableCellDisplayMode.ColorText,
  TableCellDisplayMode.ColorBackground,
]);

export type TextAlign = 'left' | 'right' | 'center';

/**
 * @internal
 * Returns the text-align value for inline-displayed cells for a field based on its type and configuration.
 */
export function getAlignment(field: Field): TextAlign {
  const align: FieldTextAlignment | undefined = field.config.custom?.align;

  if (!align || align === 'auto') {
    if (TEXT_CELL_TYPES.has(getCellOptions(field).type) && field.type === FieldType.number) {
      return 'right';
    }
    return 'left';
  }

  return align;
}

/**
 * @internal
 * Returns the justify-content value for flex-displayed cells for a field based on its type and configuration.
 */
export function getJustifyContent(textAlign: TextAlign): Property.JustifyContent {
  return textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';
}

const DEFAULT_CELL_OPTIONS = { type: TableCellDisplayMode.Auto } as const;

/**
 * @internal
 * Returns the cell options for a field, migrating from legacy displayMode if necessary.
 * TODO: remove live migration in favor of doing it in dashboard or panel migrator
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
  // let bgHoverColor: string | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
      // bgHoverColor = tinycolor(displayValue.color)
      //   .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
      //   .toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      // const hoverColor = tinycolor(displayValue.color)
      //   .darken(CELL_GRADIENT_DARKENING_MULTIPLIER * darkeningFactor)
      //   .toRgbString();
      const bgColor2 = tinycolor(displayValue.color)
        .darken(CELL_COLOR_DARKENING_MULTIPLIER * darkeningFactor)
        .spin(CELL_GRADIENT_HUE_ROTATION_DEGREES);
      textColor = getTextColorForAlphaBackground(displayValue.color!, theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
      // bgHoverColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${hoverColor})`;
    }
  }

  return { textColor, bgColor };
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

  const sortNanos = sortColumns.map(
    (c) => fields.find((f) => f.type === FieldType.time && getDisplayName(f) === c.columnKey)?.nanos
  );

  const compareRows = (a: TableRow, b: TableRow): number => {
    let result = 0;

    for (let i = 0; i < sortColumns.length; i++) {
      const { columnKey, direction } = sortColumns[i];
      const compare = getComparator(columnTypes[columnKey]);
      const sortDir = direction === 'ASC' ? 1 : -1;

      result = sortDir * compare(a[columnKey], b[columnKey]);

      if (result === 0) {
        const nanos = sortNanos[i];

        if (nanos !== undefined) {
          result = sortDir * (nanos[a.__index] - nanos[b.__index]);
        }
      }

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
    if (row.__depth === 0) {
      parentRows.push(row);
    } else {
      childRows.set(row.__index, row);
    }
  }

  // Process parent rows (filter or sort)
  const processedParents = processParents(parentRows);

  // Reconstruct the result
  const result: TableRow[] = [];
  processedParents.forEach((row) => {
    result.push(row);
    const childRow = childRows.get(row.__index);
    if (childRow) {
      result.push(childRow);
    }
  });

  return result;
};

/**
 * @internal
 * returns the display name of a field.
 * We intentionally do not want to use @grafana/data's getFieldDisplayName here,
 * instead we have a call to cacheFieldDisplayNames up in TablePanel to handle this
 * before we begin.
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

/** @internal */
export function withDataLinksActionsTooltip(field: Field, cellType: TableCellDisplayMode) {
  return (
    cellType !== TableCellDisplayMode.DataLinks &&
    cellType !== TableCellDisplayMode.Actions &&
    (field.config.links?.length ?? 0) + (field.config.actions?.length ?? 0) > 1
  );
}

export const displayJsonValue: DisplayProcessor = (value: unknown): DisplayValue => {
  let displayValue: string;

  // Handle string values that might be JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      displayValue = JSON.stringify(parsed, null, ' ');
    } catch {
      displayValue = value; // Keep original if not valid JSON
    }
  } else {
    // For non-string values, stringify them
    try {
      displayValue = JSON.stringify(value, null, ' ');
    } catch (error) {
      // Handle circular references or other stringify errors
      displayValue = String(value);
    }
  }

  return { text: displayValue, numeric: Number.NaN };
};
