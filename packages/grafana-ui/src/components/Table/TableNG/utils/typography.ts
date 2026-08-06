import { type Count, varPreLine } from 'uwrap';

import { type MeasureCellHeight, type TypographyCtx } from '../types';

import { getDisplayName } from './fields';
import { PILLS_GAP, PILLS_SPACING, inferPills } from './pills';

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
