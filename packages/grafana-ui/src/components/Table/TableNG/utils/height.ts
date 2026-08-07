import { type CSSProperties } from 'react';
import { type Count, varPreLine } from 'uwrap';

import { FieldType, type Field, formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode, TableCellHeight } from '@grafana/schema';

import { AutoCellRenderer, getCellRenderer } from '../Cells/renderers';
import { TABLE } from '../constants';
import { type MeasureCellHeight, type MeasureCellHeightEntry, type TableRow, type TypographyCtx } from '../types';

import { getCellOptions, getDisplayName, shouldTextWrap } from './fields';
import { PILLS_FONT_SIZE, PILLS_GAP, PILLS_SPACING, inferPills } from './pills';

/**
 * @internal creates a typography context based on a font size and family. used to measure text
 * and estimate size of text in cells.
 */
export function createTypographyContext(
  fontSize: number,
  fontFamily: string,
  letterSpacing = 0.15,
  fontWeight?: number
): TypographyCtx {
  const font = `${fontWeight != null ? `${fontWeight} ` : ''}${fontSize}px ${fontFamily}`;
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
    estimateHeight: getTextHeightEstimator(avgCharWidth),
    measureHeight: getTextHeightMeasurerFromUwrapCount(count),
  };
}

/**
 * @internal wraps the uwrap count function to ensure that it is given a string.
 */
export function getTextHeightMeasurerFromUwrapCount(count: Count): MeasureCellHeight {
  return (value, width, _field, _rowIdx, lineHeight) => {
    if (value == null) {
      return lineHeight;
    }

    const lines = count(String(value), width);
    return lines * lineHeight;
  };
}

const spaceRegex = /[\s-]/;

/**
 * @internal returns a measurer which guesstimates a number of lines in a text cell based on the typography context's avgCharWidth.
 */
export function getTextHeightEstimator(avgCharWidth: number): MeasureCellHeight {
  return (value, width, _field, _rowIdx, lineHeight) => {
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
    const lines = Math.ceil(strValue.length / charsPerLine);
    return lines * lineHeight;
  };
}

/**
 * @internal
 */
export function getDataLinksHeightMeasurer(): MeasureCellHeight {
  const linksCountCache: Record<string, number> = {};

  // when we render links, we need to filter out the invalid links. since the call to `getLinks` is expensive,
  // we'll cache the result and reuse it for every row in the table. this cache is cleared when line counts are
  // rebuilt anytime from the `useRowHeight` hook, and that includes adding and removing data links.
  return (_value, _width, field, _rowIdx, lineHeight) => {
    const cacheKey = getDisplayName(field);
    if (linksCountCache[cacheKey] === undefined) {
      let count = 0;
      for (const l of field.config?.links ?? []) {
        if (l.onClick || l.url) {
          count += 1;
        }
      }
      linksCountCache[cacheKey] = count;
    }

    return linksCountCache[cacheKey] * lineHeight;
  };
}

export function getPillCellHeightMeasurer(measureWidth: (value: string) => number): MeasureCellHeight {
  // Per-pill intrinsic width, keyed by the pill string — shared across values (e.g. an actor who
  // appears in many rows) and across column widths, so a resize never re-measures pill text.
  const pillWidthCache: Record<string, number> = {};
  // Per-value laid-out pill widths (intrinsic width + chip padding), keyed by the cell value and
  // therefore width-independent: on a resize we reuse these and skip both inferPills and text
  // measurement, redoing only the cheap wrap arithmetic below. Neither cache needs eviction: the
  // whole closure is rebuilt when fields/typography/maxHeight change, so they live only as long as
  // the current table structure and are bounded by its distinct values.
  const pillWidthsByValue = new Map<string, number[]>();

  return (value, width, _field, _rowIdx, lineHeight) => {
    if (value == null) {
      return 0;
    }

    const strValue = String(value);
    let pillWidths = pillWidthsByValue.get(strValue);
    if (pillWidths === undefined) {
      pillWidths = inferPills(strValue).map((pill) => {
        const strPill = String(pill);
        let rawWidth = pillWidthCache[strPill];
        if (rawWidth === undefined) {
          rawWidth = measureWidth(strPill);
          pillWidthCache[strPill] = rawWidth;
        }
        return rawWidth + PILLS_SPACING;
      });
      pillWidthsByValue.set(strValue, pillWidths);
    }

    if (pillWidths.length === 0) {
      return 0;
    }

    // wrap arithmetic over the (cached) pill widths. This is cheap enough to run per cell; the
    // expensive parts — parsing and text measurement — are what the caches above eliminate.
    let lines = 0;
    let currentLineUse = width;
    for (const pillWidth of pillWidths) {
      if (currentLineUse + pillWidth + PILLS_GAP > width) {
        lines++;
        currentLineUse = pillWidth;
      } else {
        currentLineUse += pillWidth + PILLS_GAP;
      }
    }

    // default line height happens to be the height of a pill, but maybe we need a custom
    // const here to make sure this doesn't get out of sync with the actual pill height.
    return lines * lineHeight + (lines - 1) * PILLS_GAP;
  };
}

/**
 * @internal
 * Returns the default row height based on the theme and cell height setting.
 */
export function getDefaultRowHeight(
  theme: GrafanaTheme2,
  fields?: Field[],
  cellHeight?: TableCellHeight
): NonNullable<CSSProperties['height']> {
  if (fields?.some((field) => field.config?.custom?.cellOptions?.dynamicHeight)) {
    return 'min-content';
  }

  switch (cellHeight) {
    case TableCellHeight.Sm:
      return 36;
    case TableCellHeight.Md:
      return 42;
    case TableCellHeight.Lg:
      return TABLE.MAX_CELL_HEIGHT;
  }

  return TABLE.CELL_PADDING * 2 + theme.typography.fontSize * theme.typography.body.lineHeight;
}

/**
 * @internal wrap a cell height measurer to clamp its output to the maxHeight defined in the field, if any.
 */
function clampByMaxHeight(measurer: MeasureCellHeight, maxHeight = Infinity): MeasureCellHeight {
  return (value, width, field, rowIdx, lineHeight) => {
    const rawHeight = measurer(value, width, field, rowIdx, lineHeight);
    return Math.min(rawHeight, maxHeight);
  };
}

/**
 * @internal return a text measurer for every field which has wrapHeaderText enabled.
 */
export function buildHeaderHeightMeasurers(
  fields: Field[],
  typographyCtx: TypographyCtx
): MeasureCellHeightEntry[] | undefined {
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
  return [{ measure: typographyCtx.measureHeight, fieldIdxs: wrappedColIdxs }];
}

/**
 * @internal return a text height measurer for every field which has wrapHeaderText enabled. we do this once as we're rendering
 * the table, and then getRowHeight uses the output of this to caluclate the height of each row.
 */
export function buildCellHeightMeasurers(
  fields: Field[],
  typographyCtx: TypographyCtx,
  maxHeight?: number
): MeasureCellHeightEntry[] | undefined {
  const result: Record<string, MeasureCellHeightEntry> = {};
  let wrappedFields = 0;

  const measurerFactory: Record<
    TableCellDisplayMode.Auto | TableCellDisplayMode.DataLinks | TableCellDisplayMode.Pill,
    () => [MeasureCellHeight, MeasureCellHeight?]
  > = {
    // for string fields, we estimate the length of a line using `avgCharWidth` to limit expensive calls `count`.
    [TableCellDisplayMode.Auto]: () => [typographyCtx.measureHeight, typographyCtx.estimateHeight],
    [TableCellDisplayMode.DataLinks]: () => [getDataLinksHeightMeasurer(), undefined],
    // pills use a different font size, so they require their own typography context.
    [TableCellDisplayMode.Pill]: () => {
      const pillTypographyCtx = createTypographyContext(
        PILLS_FONT_SIZE,
        typographyCtx.fontFamily,
        typographyCtx.letterSpacing
      );
      return [getPillCellHeightMeasurer((value) => pillTypographyCtx.ctx.measureText(value).width), undefined];
    },
  } as const;

  const setupMeasurerForIdx = (measurerFactoryKey: keyof typeof measurerFactory, fieldIdx: number) => {
    if (!result[measurerFactoryKey]) {
      const [measure, estimate] = measurerFactory[measurerFactoryKey]();
      result[measurerFactoryKey] = {
        measure: clampByMaxHeight(measure, maxHeight),
        estimate: estimate != null ? clampByMaxHeight(estimate, maxHeight) : undefined,
        fieldIdxs: [],
      };
    }
    result[measurerFactoryKey].fieldIdxs.push(fieldIdx);
  };

  for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
    const field = fields[fieldIdx];
    if (shouldTextWrap(field)) {
      wrappedFields++;

      const cellType = getCellOptions(field).type;
      if (cellType === TableCellDisplayMode.DataLinks) {
        setupMeasurerForIdx(TableCellDisplayMode.DataLinks, fieldIdx);
      } else if (cellType === TableCellDisplayMode.Pill) {
        setupMeasurerForIdx(TableCellDisplayMode.Pill, fieldIdx);
      } else if (getCellRenderer(field, getCellOptions(field)) === AutoCellRenderer) {
        // Any field rendered by AutoCellRenderer (string, time, number, boolean, etc.) can
        // produce a multi-line formatted string, so we include it in height measurement.
        setupMeasurerForIdx(TableCellDisplayMode.Auto, fieldIdx);
      } else {
        // no measurer was configured for this cell type
        wrappedFields--;
      }
    }
  }

  if (wrappedFields === 0) {
    return undefined;
  }

  return Object.values(result);
}

// in some cases, the estimator might return a value that is less than 1, but when calculated by the measurer, it actually
// realizes that it's a multi-line cell. to avoid this, we want to give a little buffer away from 1 before we fully trust
// the estimator to have told us that a cell is single-line.
export const SINGLE_LINE_ESTIMATE_THRESHOLD = 18.5;

/**
 * @internal
 * loop through the fields and their values, determine which cell is going to determine the height of the row based
 * on its content and width, and return the height in pixels of that row, with vertial padding applied.
 */
export function getRowHeight(
  fields: Field[],
  row: TableRow,
  columnWidths: number[],
  defaultHeight: number,
  measurers?: MeasureCellHeightEntry[],
  lineHeight = TABLE.LINE_HEIGHT,
  verticalPadding = TABLE.CELL_PADDING * 2
): number {
  if (!measurers?.length) {
    return defaultHeight;
  }

  let maxHeight = -1;
  let maxValue: unknown = '';
  let maxWidth = 0;
  let maxField: Field | undefined;
  let preciseMeasurer: MeasureCellHeight | undefined;
  // Tallest height from measurers that already ran precisely (pills, data links). The estimated
  // winner is remeasured below and can shrink beneath one of these, so we clamp back up to it —
  // otherwise an over-estimating Auto column could beat a precise pill height and then discard it,
  // sizing the row too short and clipping the pills.
  let maxPreciseHeight = -1;

  for (const { estimate, measure, fieldIdxs } of measurers) {
    // for some of the cell height measurers, getting the precise height is expensive. those entries set
    // both "estimate" and "measure" functions. if the cell we find to be the max was estimated, we will
    // get the "true" value right before calculating the row height by keeping a reference to the measure fn.
    const measurer = (estimate ?? measure) satisfies MeasureCellHeight;
    const isEstimating = estimate !== undefined;

    for (const fieldIdx of fieldIdxs) {
      const field = fields[fieldIdx];
      const displayName = getDisplayName(field);
      // special case: for the header, provide `-1` as the row index.
      const cellValueRaw = row.__index === -1 ? displayName : row[displayName];
      if (cellValueRaw != null) {
        // For non-string fields (e.g. Time, Number), the raw value is a number/epoch that
        // AutoCell formats via field.display() before rendering. Measure the rendered string
        // so the height matches what is actually displayed in the cell.
        const cellValueForMeasuring =
          field.type !== FieldType.string && row.__index !== -1 && field.display != null
            ? formattedValueToString(field.display(cellValueRaw))
            : cellValueRaw;
        const colWidth = columnWidths[fieldIdx];
        const estimatedHeight = measurer(cellValueForMeasuring, colWidth, field, row.__index, lineHeight);
        if (!isEstimating && estimatedHeight > maxPreciseHeight) {
          maxPreciseHeight = estimatedHeight;
        }
        if (estimatedHeight > maxHeight) {
          maxHeight = estimatedHeight;
          maxValue = cellValueForMeasuring;
          maxWidth = colWidth;
          maxField = field;
          preciseMeasurer = isEstimating ? measure : undefined;
        }
      }
    }
  }

  // if the value is -1 or the estimate for the max cell was less than the SINGLE_LINE_ESTIMATE_THRESHOLD, we trust
  // that the estimator correctly identified that no text wrapping is needed for this row, skipping the preciseMeasurer.
  if (maxField === undefined || maxHeight < SINGLE_LINE_ESTIMATE_THRESHOLD) {
    return defaultHeight;
  }

  // if we finished this row height loop with an estimate, we need to call
  // the `preciseMeasurer` method to get the exact line count. the remeasured winner can come back
  // shorter than a column we already measured precisely, so never drop below that height.
  if (preciseMeasurer !== undefined) {
    maxHeight = Math.max(preciseMeasurer(maxValue, maxWidth, maxField, row.__index, lineHeight), maxPreciseHeight);
  }

  // adjust for vertical padding, and clamp to a minimum default height
  return Math.max(maxHeight + verticalPadding, defaultHeight);
}

/**
 * @internal
 * Calculate the footer height based on the maximum reducer count
 */
export const calculateFooterHeight = (fields: Field[]): number => {
  let maxReducerCount = 0;
  for (const field of fields) {
    maxReducerCount = Math.max(maxReducerCount, field.config.custom?.footer?.reducers?.length ?? 0);
  }

  // Base height (+ padding) + height per reducer
  return maxReducerCount > 0 ? maxReducerCount * TABLE.LINE_HEIGHT + TABLE.CELL_PADDING * 2 : 0;
};
