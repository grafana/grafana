import { type Field, type GrafanaTheme2 } from '@grafana/data';

import { TableCellDisplayMode } from '../types';

import { AutoCellRenderer, getCellRenderer } from './Cells/renderers';
import type { MeasureCellHeight, MeasureCellHeightEntry, TextWrapFallback, TypographyCtx } from './types';
import {
  createTypographyContext,
  getCellOptions,
  getDataLinksHeightMeasurer,
  getDisplayName,
  getPillCellHeightMeasurer,
  getPillMetrics,
  rendersAsJson,
  shouldTextWrap,
} from './utils';

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
 * @internal return a text height measurer for every field which has wrapHeaderText enabled. we do this once as we're rendering
 * the table, and then getRowHeight uses the output of this to caluclate the height of each row.
 */
export function buildCellHeightMeasurers(
  fields: Field[],
  typographyCtx: TypographyCtx,
  theme: GrafanaTheme2,
  maxHeight?: number,
  wrapFallback?: TextWrapFallback
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
      const { fontSize, spacing, gap } = getPillMetrics(theme);
      const pillTypographyCtx = createTypographyContext(
        fontSize,
        typographyCtx.fontFamily,
        typographyCtx.letterSpacing
      );
      return [
        getPillCellHeightMeasurer((value) => pillTypographyCtx.ctx.measureText(value).width, spacing, gap),
        undefined,
      ];
    },
  } as const;

  const setupMeasurerForIdx = (measurerFactoryKey: keyof typeof measurerFactory, fieldIdx: number) => {
    if (!result[measurerFactoryKey]) {
      const [measure, estimate] = measurerFactory[measurerFactoryKey]();
      const guard = (measurer: MeasureCellHeight): MeasureCellHeight => {
        if (measurerFactoryKey !== TableCellDisplayMode.Auto || wrapFallback == null) {
          return measurer;
        }
        return (value, width, field, rowIdx, lineHeight) =>
          wrapFallback.shouldDisable(field, value) ? -1 : measurer(value, width, field, rowIdx, lineHeight);
      };
      result[measurerFactoryKey] = {
        measure: guard(clampByMaxHeight(measure, maxHeight)),
        estimate: estimate != null ? guard(clampByMaxHeight(estimate, maxHeight)) : undefined,
        fieldIdxs: [],
      };
    }
    result[measurerFactoryKey].fieldIdxs.push(fieldIdx);
  };

  for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
    const field = fields[fieldIdx];
    if (shouldTextWrap(field) && !wrapFallback?.disabledFields.has(getDisplayName(field))) {
      wrappedFields++;

      const cellType = getCellOptions(field).type;
      if (cellType === TableCellDisplayMode.DataLinks) {
        setupMeasurerForIdx(TableCellDisplayMode.DataLinks, fieldIdx);
      } else if (cellType === TableCellDisplayMode.Pill) {
        setupMeasurerForIdx(TableCellDisplayMode.Pill, fieldIdx);
      } else if (
        cellType === TableCellDisplayMode.Status ||
        rendersAsJson(field) ||
        getCellRenderer(field, getCellOptions(field)) === AutoCellRenderer
      ) {
        // JSON, Status and Auto cells can produce multiline formatted strings, so all need measurement.
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
