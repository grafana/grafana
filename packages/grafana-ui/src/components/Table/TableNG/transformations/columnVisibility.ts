import { type DataFrame, type DataTransformerConfig, type MatcherConfig } from '@grafana/data';

import { getFrameFilter, getSourceFrameIndex, prepareColumnContext } from './columnContext';
import { EMPTY_OPTIONS, findColumnsEntry, writeColumnsEntry } from './organizeFields';
import { type ColumnContext, type TableTransformation } from './types';

export function readColumnVisibility(configs: readonly DataTransformerConfig[], frameFilter?: MatcherConfig) {
  const { excludeByName = {} } = findColumnsEntry(configs, frameFilter)?.options ?? {};
  return { hiddenColumns: new Set(Object.keys(excludeByName).filter((name) => excludeByName[name])) };
}

/**
 * Stores the hidden TableNG columns in the matching organize-fields transformation.
 * Existing column order, renames, and transformations outside this frame scope are preserved.
 */
export function encodeHiddenColumns(
  transformations: readonly DataTransformerConfig[],
  hidden: ReadonlySet<string>,
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const excludeByName = Array.from(hidden).reduce<Record<string, boolean>>((acc, name) => {
    acc[name] = true;
    return acc;
  }, {});

  return writeColumnsEntry(
    transformations,
    { ...EMPTY_OPTIONS, ...findColumnsEntry(transformations, frameFilter)?.options, excludeByName },
    frameFilter
  );
}

export function ensureVisibleColumnPerFrame(
  transformations: readonly DataTransformerConfig[],
  sourceSeries: readonly DataFrame[]
): readonly DataTransformerConfig[] {
  return sourceSeries.reduce((current, _frame, index) => {
    if (getSourceFrameIndex(sourceSeries, index, sourceSeries) < 0) {
      return current;
    }
    const { hiddenColumns } = readColumnVisibility(current, getFrameFilter(sourceSeries, index));
    if (hiddenColumns.size === 0) {
      return current;
    }
    const context = prepareColumnContext(sourceSeries, index);
    if (!context || context.catalog.length === 0) {
      return current;
    }
    if (context.catalog.some((name) => !hiddenColumns.has(name))) {
      return current;
    }

    // A refresh can leave only hidden columns. Reveal one so the table and its controls remain reachable.
    hiddenColumns.delete(context.catalog[0]);
    return encodeHiddenColumns(current, hiddenColumns, context.frameFilter);
  }, transformations);
}

export const columnVisibility = {
  read: (configs, { frameFilter }) => readColumnVisibility(configs, frameFilter),
  write: (configs, hidden, { frameFilter }) => encodeHiddenColumns(configs, hidden, frameFilter),
} satisfies TableTransformation<{ hiddenColumns: ReadonlySet<string> }, ReadonlySet<string>, ColumnContext>;
