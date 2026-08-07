import { FieldType, type Field, fieldReducers, formattedValueToString, reduceField, ReducerID } from '@grafana/data';
import { type ColumnWidth, type ColumnWidths, type SortColumn } from '@grafana/react-data-grid';
import { TableCellDisplayMode } from '@grafana/schema';

import { getAutoRendererDisplayMode } from '../Cells/renderers';
import { CELL_HORIZONTAL_CHROME, COLUMN, HEADER_ICON_SPACE, TABLE } from '../constants';
import { type GetActionsFunctionLocal, type TypographyCtx } from '../types';

import { getCellLinks } from './display';
import { getCellOptions, getDisplayName, shouldTextWrap } from './fields';
import { PILLS_GAP, PILLS_SPACING, inferPills } from './pills';

// Fuzzy chrome estimates for the other inline-run cell types (see measureInlineRunWidth). Used only
// for auto-width sizing, so approximate values that slightly over-reserve are fine.
const LINK_SPACING = 8; // paddingInline (~4px each side) when data links sit inline
const LINK_GAP = 2; // separator border between inline data links
const ACTION_SPACING = 20; // horizontal padding of a small action Button
const ACTION_GAP = 6; // theme.spacing(0.75) gap between action buttons

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

// Bounds the amount of work content-aware sizing does. We sample at most MAX_SAMPLE rows per
// column and shrink the per-column sample as the column count grows so a very wide frame doesn't
// blow up the measurement budget. The sample is spread evenly across the whole field (see
// sampleIndices) rather than taken from the front, so a sorted or clustered column isn't sized from
// just its first — e.g. smallest — values.
const TARGET_MEASUREMENTS = 2000;
const MIN_SAMPLE = 20;
const MAX_SAMPLE = 100;

/**
 * Evenly-spaced row indices spanning the whole field, inclusive of the first and last rows. Sizing
 * from the first N rows biases sorted/clustered columns (an ascending column would be measured from
 * its shortest values, an alphabetical one from a single letter); spreading the sample across the
 * field — and always including the last row — captures the extremes wherever the sort puts them.
 * Deterministic on purpose: true random sampling would make column widths jitter between recomputes.
 */
function sampleIndices(totalLen: number, sampleSize: number): number[] {
  const n = Math.min(sampleSize, totalLen);
  if (n <= 0) {
    return [];
  }
  if (n === 1) {
    return [0];
  }
  const step = (totalLen - 1) / (n - 1);
  const indices = new Array<number>(n);
  for (let k = 0; k < n; k++) {
    indices[k] = Math.round(k * step);
  }
  return indices;
}

export interface ContentAwareColWidthsOptions {
  typographyCtx: TypographyCtx;
  /**
   * Header labels render at `fontWeightMedium`, which is wider than the body text this measures.
   * When provided, header widths are measured with this (medium-weight) context so a column that
   * hugs its header doesn't ellipsize the title; falls back to `typographyCtx` when absent.
   */
  headerTypographyCtx?: TypographyCtx;
  showTypeIcons?: boolean;
  /** Bound `(field, rowIdx) => actions`, so Actions columns can be sized to their button labels. */
  getActions?: GetActionsFunctionLocal;
  /** Currently-sorted columns; a sorted column reserves header space for its sort arrow. */
  sortColumns?: SortColumn[];
  /** overridable for testing; otherwise derived from the auto-column count */
  sampleSize?: number;
}

/** Formats a raw cell value the way it renders, so we measure what the user actually sees. */
function formatCellValue(field: Field, value: unknown): string {
  if (value == null) {
    return '';
  }
  // AutoCell renders field.display(value) for every field type, so measure the same thing.
  // String fields go through it too: they can carry units, value mappings, or other formatting.
  if (field.display != null) {
    return formattedValueToString(field.display(value));
  }
  return String(value);
}

/**
 * Estimates the pixel width of the longest content in a field from character count. Width is
 * proportional to length under `avgCharWidth`, so the longest-by-length value is the widest — we
 * just track the max length and scale it, no per-value canvas measurement. This trades exact
 * proportional-font width (e.g. "WWW" vs "iiiiii") for a cheap estimate the global cap bounds.
 */
function measureLongestContentWidth(field: Field, sampleSize: number, avgCharWidth: number): number {
  let maxLen = 0;
  for (const i of sampleIndices(field.values.length, sampleSize)) {
    maxLen = Math.max(maxLen, formatCellValue(field, field.values[i]).length);
  }
  return maxLen * avgCharWidth;
}

/**
 * Width a column of inline "runs" wants — cells that render several chips/links/buttons flowing
 * horizontally and wrapping (pills, data links, actions). Measuring the single longest value like a
 * text cell is wrong: it ignores that a cell holds several items. Instead we size to fit an
 * *average row's* combined item width (per-item `chrome` + inter-item `gap`) on roughly one line,
 * which the global cap then bounds so long runs wrap to a few lines rather than one-item-per-line.
 * The floor is the widest single item so none is ever clipped. Mirrors PillCell geometry.
 *
 * Item text is estimated from character count (`avgCharWidth`) rather than canvas-measured — the
 * fuzzy sizing used elsewhere. It slightly over-estimates, which errs toward roomier columns: the
 * safe direction for avoiding clipped items. `itemsForRow` returns the display text of each item in
 * a sampled row (empty when the row has none); `indices` are the sampled rows (see sampleIndices).
 */
function measureInlineRunWidth(
  indices: number[],
  itemsForRow: (rowIdx: number) => string[],
  avgCharWidth: number,
  chrome: number,
  gap: number,
  // When the items stack vertically instead of flowing horizontally (e.g. a wrapped DataLinks cell
  // lays its links out in a column), the width follows the widest single item, not the row's run.
  stack = false
): number {
  let widestItem = 0;
  let rowTotalSum = 0;
  let sampledRows = 0;

  for (const i of indices) {
    const items = itemsForRow(i);
    if (items.length === 0) {
      continue;
    }

    let rowTotal = 0;
    for (const text of items) {
      const itemWidth = text.length * avgCharWidth + chrome;
      widestItem = Math.max(widestItem, itemWidth);
      rowTotal += itemWidth;
    }
    rowTotal += gap * (items.length - 1);
    rowTotalSum += rowTotal;
    sampledRows++;
  }

  if (sampledRows === 0) {
    return 0;
  }

  return stack ? widestItem : Math.max(rowTotalSum / sampledRows, widestItem);
}

/**
 * Width the header label needs, including its filter/sort/type-icon affordances.
 *
 * Unlike body content, the header is canvas-measured exactly rather than estimated from
 * `avgCharWidth`. It sets a hard lower bound the content is unioned with, so an under-estimate here
 * truncates the title outright. Exactness is affordable: it's one short string measured once per
 * column, not a value sampled across many rows.
 *
 * The sort arrow only appears once a column is sorted, so a tight column would otherwise ellipsize
 * its title the moment it's sorted; reserving its space when `isSorted` keeps the label readable
 * (the width recomputes on sort, so unsorted columns don't pay for it).
 */
function measureHeaderWidth(field: Field, ctx: TypographyCtx, showTypeIcons: boolean, isSorted: boolean): number {
  const textWidth = ctx.ctx.measureText(getDisplayName(field)).width;
  let iconSpace = 0;
  if (field.config?.custom?.filterable) {
    iconSpace += HEADER_ICON_SPACE;
  }
  if (showTypeIcons) {
    iconSpace += HEADER_ICON_SPACE;
  }
  if (isSorted) {
    iconSpace += HEADER_ICON_SPACE;
  }
  return textWidth + iconSpace + CELL_HORIZONTAL_CHROME;
}

// gap between a footer reducer's label and its value (theme.spacing(0.5), matches SummaryCell).
const FOOTER_LABEL_GAP = 4;

// Reducers the footer renders unformatted (raw count), skipping the field's display processor —
// mirrors SummaryCell so a count on a time/unit column isn't measured as a formatted value.
const FOOTER_UNFORMATTED_REDUCERS = new Set<string>([ReducerID.count, ReducerID.countAll]);

/**
 * Width a column's footer/summary cell needs. Each configured reducer renders its label (e.g. "Sum")
 * inline with its reduced value, so a column that hugs its body content can truncate a wider footer.
 * Size to the widest reducer row (label + value, estimated from `avgCharWidth`); returns 0 when the
 * column has no footer. The reduced values are computed the same way the footer renders them.
 */
function measureFooterWidth(field: Field, avgCharWidth: number): number {
  const reducers = field.config.custom?.footer?.reducers;
  if (reducers == null || reducers.length === 0) {
    return 0;
  }
  // Reduce over a copy with its own `state` so we never touch the shared `field.state.calcs`:
  // reduceField reads and writes that cache, and the footer (useReducerEntries) relies on it —
  // reducing the full, unfiltered values here would otherwise leave the footer showing whole-dataset
  // stats while the table is filtered.
  const results = reduceField({ field: { ...field, state: undefined }, reducers });
  let widest = 0;
  for (const id of reducers) {
    const label = fieldReducers.get(id)?.name ?? id;
    const value = results[id];
    // count/countAll render raw (String), like the footer; everything else goes through display.
    const valueText =
      value == null ? '' : FOOTER_UNFORMATTED_REDUCERS.has(id) ? String(value) : formatCellValue(field, value);
    widest = Math.max(widest, (label.length + valueText.length) * avgCharWidth + FOOTER_LABEL_GAP);
  }
  return widest + CELL_HORIZONTAL_CHROME;
}

interface ColWidthMeasureCtx {
  typographyCtx: TypographyCtx;
  /** Bound `(field, rowIdx) => actions`, used to size Actions columns; absent when not wired. */
  getActions?: GetActionsFunctionLocal;
}

/**
 * A cell type's content-width strategy: the width its content wants, including any horizontal
 * chrome. The caller unions this with the header width and clamps it to `[floor, cap]`.
 */
type MeasureColWidth = (field: Field, sampleSize: number, ctx: ColWidthMeasureCtx) => number;

// Graphical cells don't render free text — gauges need bar room, sparklines/geo are pictorial — so
// they take a fixed default instead of being measured.
const measureGraphicalColWidth: MeasureColWidth = () => COLUMN.DEFAULT_WIDTH;

// Images scale to the cell (object-fit: contain), so a wide column is mostly whitespace — a small
// fixed default reads better than the graphical default.
const measureImageColWidth: MeasureColWidth = () => COLUMN.IMAGE_WIDTH;

const measurePillColWidth: MeasureColWidth = (field, sampleSize, { typographyCtx }) =>
  measureInlineRunWidth(
    sampleIndices(field.values.length, sampleSize),
    // PillCell renders formattedValueToString(field.display(pill)); estimate from that same text so
    // value mappings/units are reflected. formatCellValue falls back to String() with no display.
    (i) => inferPills(field.values[i]).map((pill) => formatCellValue(field, pill)),
    typographyCtx.avgCharWidth,
    PILLS_SPACING,
    PILLS_GAP
  ) + CELL_HORIZONTAL_CHROME;

const measureDataLinksColWidth: MeasureColWidth = (field, sampleSize, { typographyCtx }) =>
  measureInlineRunWidth(
    sampleIndices(field.values.length, sampleSize),
    // DataLinksCell renders one <a> per link title; getCellLinks resolves the same links per row.
    (i) => getCellLinks(field, i)?.map((link) => link.title ?? '') ?? [],
    typographyCtx.avgCharWidth,
    LINK_SPACING,
    LINK_GAP,
    // when wrapping, DataLinksCell stacks its links vertically, so size to the widest single link.
    shouldTextWrap(field)
  ) + CELL_HORIZONTAL_CHROME;

const measureActionsColWidth: MeasureColWidth = (field, sampleSize, { typographyCtx, getActions }) => {
  if (getActions == null) {
    return 0; // actions aren't wired in this context; fall back to the header/floor width
  }
  return (
    measureInlineRunWidth(
      sampleIndices(field.values.length, sampleSize),
      // ActionsCell renders one Button per action, labelled action.title.
      (i) => getActions(field, i).map((action) => action.title),
      typographyCtx.avgCharWidth,
      ACTION_SPACING,
      ACTION_GAP
    ) + CELL_HORIZONTAL_CHROME
  );
};

// `avgCharWidth` is derived from a prose sample, so it under-estimates digit/symbol-heavy strings
// like dates and timestamps, leaving those columns cramped. Give string/time columns a cell-padding's
// worth of slack so they get a little breathing room rather than hugging the content exactly.
// Numeric/boolean columns are left tight on purpose — hugging their short values is the whole point.
const TEXT_WIDTH_WIGGLE = TABLE.CELL_PADDING;

const measureTextColWidth: MeasureColWidth = (field, sampleSize, { typographyCtx }) => {
  const width = measureLongestContentWidth(field, sampleSize, typographyCtx.avgCharWidth) + CELL_HORIZONTAL_CHROME;
  const isText = field.type === FieldType.string || field.type === FieldType.time;
  return isText ? width + TEXT_WIDTH_WIGGLE : width;
};

// Markdown always wraps (its cell style forces whiteSpace: normal) and renders formatted, so its
// raw source string is a poor proxy for rendered width — markup syntax and long link URLs would
// stretch the column to the cap. Contribute no content width so it sizes to its header and wraps to
// extra height instead, the same as a wrapped free-text column.
const measureMarkdownColWidth: MeasureColWidth = () => 0;

// Singleton registry mirroring the buildCellHeightMeasurers factory map: cell types that size
// differently from the default text measurement register here; anything absent falls back to
// measureTextColWidth.
const COL_WIDTH_MEASURERS: Partial<Record<TableCellDisplayMode, MeasureColWidth>> = {
  [TableCellDisplayMode.Sparkline]: measureGraphicalColWidth,
  [TableCellDisplayMode.Gauge]: measureGraphicalColWidth,
  [TableCellDisplayMode.BasicGauge]: measureGraphicalColWidth,
  [TableCellDisplayMode.GradientGauge]: measureGraphicalColWidth,
  [TableCellDisplayMode.LcdGauge]: measureGraphicalColWidth,
  [TableCellDisplayMode.Image]: measureImageColWidth,
  [TableCellDisplayMode.Geo]: measureGraphicalColWidth,
  [TableCellDisplayMode.Pill]: measurePillColWidth,
  [TableCellDisplayMode.Actions]: measureActionsColWidth,
  [TableCellDisplayMode.DataLinks]: measureDataLinksColWidth,
  [TableCellDisplayMode.Markdown]: measureMarkdownColWidth,
};

const DEFAULT_GROWTH_WEIGHT = 1;

// Per-field-type multiplier on a column's share of the panel's leftover space (see the grow step
// below). Types absent from this map fall back to DEFAULT_GROWTH_WEIGHT. Numeric and boolean
// columns hold short, fixed-width values, so a smaller weight keeps them comparatively tight while
// strings/dates/pills take most of the slack (a shared weight cancels out, so an all-numeric table
// still fills the panel). Broken out per type so each can be tuned individually later.
const GROWTH_WEIGHTS: Partial<Record<FieldType, number>> = {
  [FieldType.number]: 0.35,
  [FieldType.boolean]: 0.35,
};

function growthWeight(type: FieldType): number {
  return GROWTH_WEIGHTS[type] ?? DEFAULT_GROWTH_WEIGHT;
}

/**
 * @internal
 * Content-aware variant of {@link computeColWidths}. Columns with a configured `custom.width` keep
 * that exact width. Every other ("auto") column is sized to fit its content:
 *   1. its cell content (a sampled, display-formatted, measured max) or a per-type default for
 *      graphical cells, whichever applies, unioned with its header label width;
 *   2. clamped to `[max(MIN_WIDTH, custom.minWidth), MAX_AUTO_WIDTH]`;
 *   3. then, if the auto columns don't fill the available width, the leftover is distributed by a
 *      growth share of `growthWeight × √(content width)`, so a column with more content still takes
 *      more slack (a busy pill column beats a sparse one) while the √ damps the spread enough that
 *      the widest column doesn't run away from its neighbours; numeric/boolean columns grow only
 *      modestly (see {@link growthWeight}).
 * When content overflows the available width the content widths are kept and the grid scrolls.
 */
export function computeContentAwareColWidths(
  fields: Field[],
  availWidth: number,
  {
    typographyCtx,
    headerTypographyCtx = typographyCtx,
    showTypeIcons = false,
    getActions,
    sortColumns,
    sampleSize,
  }: ContentAwareColWidthsOptions
): number[] {
  const autoIdxs: number[] = [];
  let definedWidth = 0;

  const widths = fields.map((field, i) => {
    const configured = field.config.custom?.width ?? 0;
    if (configured) {
      definedWidth += configured;
      return configured;
    }
    autoIdxs.push(i);
    return 0;
  });

  if (autoIdxs.length === 0) {
    return widths;
  }

  const effectiveSampleSize =
    sampleSize ?? Math.min(MAX_SAMPLE, Math.max(MIN_SAMPLE, Math.floor(TARGET_MEASUREMENTS / autoIdxs.length)));

  // content width per auto column, clamped to [floor, cap]
  const contentWidths = new Map<number, number>();
  let contentTotal = 0;

  const measureCtx: ColWidthMeasureCtx = { typographyCtx, getActions };
  const sortedKeys = new Set(sortColumns?.map((c) => c.columnKey));

  for (const i of autoIdxs) {
    const field = fields[i];
    const headerWidth = measureHeaderWidth(
      field,
      headerTypographyCtx,
      showTypeIcons,
      sortedKeys.has(getDisplayName(field))
    );

    // Every column is sized to its content (unioned with the header below), including wrapped ones:
    // a wrapped column still gets a content-based width so a content-heavy column (e.g. long text)
    // stays wider than a sparse one — the cap keeps it bounded and it wraps to extra height within.
    // The cell type's registered measurer handles pills/links/actions/graphical; text is default.
    const cellType = getCellOptions(field).type;
    const measure =
      COL_WIDTH_MEASURERS[cellType === TableCellDisplayMode.Auto ? getAutoRendererDisplayMode(field) : cellType] ??
      measureTextColWidth;
    const cellWidth = measure(field, effectiveSampleSize, measureCtx);
    const footerWidth = measureFooterWidth(field, typographyCtx.avgCharWidth);

    const floor = Math.max(COLUMN.MIN_WIDTH, field.config.custom?.minWidth ?? 0);
    const cap = Math.max(COLUMN.MAX_AUTO_WIDTH, floor);
    const clamped = Math.min(Math.max(Math.max(cellWidth, headerWidth, footerWidth), floor), cap);

    contentWidths.set(i, clamped);
    contentTotal += clamped;
  }

  // Distribute leftover space by a growth share of growthWeight × √(content width): a column with
  // more content grows more (a busy pill column beats a sparse one), but the √ damps the spread so
  // the widest column doesn't run away from its neighbours, and the per-type weight keeps
  // numeric/boolean columns comparatively tight. On overflow content widths are kept (grid scrolls).
  const growShare = (i: number) => growthWeight(fields[i].type) * Math.sqrt(contentWidths.get(i)!);
  const growTotal = autoIdxs.reduce((sum, i) => sum + growShare(i), 0);

  const leftover = availWidth - definedWidth - contentTotal;
  // Round cumulatively so the auto columns' rounded widths sum to the same total as their exact
  // widths. Rounding each share independently can push the total a pixel or two past availWidth and
  // trigger a spurious horizontal scrollbar on a table that should exactly fill the panel.
  let exactSoFar = 0;
  let roundedSoFar = 0;
  for (const i of autoIdxs) {
    const contentWidth = contentWidths.get(i)!;
    const grown = leftover > 0 && growTotal > 0 ? contentWidth + leftover * (growShare(i) / growTotal) : contentWidth;
    exactSoFar += grown;
    const rounded = Math.round(exactSoFar) - roundedSoFar;
    roundedSoFar += rounded;
    widths[i] = rounded;
  }

  return widths;
}

export function buildNestedColumnWidthsMap(fields: Field[], widths: number[]): ColumnWidths {
  return new Map<string, ColumnWidth>(
    fields.map((field, idx) => [getDisplayName(field), { type: 'resized', width: widths[idx] }])
  );
}
