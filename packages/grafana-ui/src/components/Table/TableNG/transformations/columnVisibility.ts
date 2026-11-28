import { type DataFrame, type DataTransformerConfig, type MatcherConfig } from '@grafana/data';

import { getVisibleFields } from '../utils';

import {
  getFrameFilter,
  getSourceFrameIndex,
  prepareColumnContext,
  toCatalogNames,
  toDisplayNames,
} from './columnContext';
import {
  EMPTY_OPTIONS,
  findColumnsEntry,
  normalizeColumnsEntry,
  withColumnReferences,
  writeColumnsEntry,
} from './organizeFields';
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

function readHiddenColumns(configs: readonly DataTransformerConfig[], context: ColumnContext): Set<string> {
  const { hiddenColumns } = readColumnVisibility(normalizeColumnsEntry(configs, context), context.frameFilter);
  return new Set(context.catalog.filter((name) => hiddenColumns.has(name)));
}

function writeHiddenColumns(
  configs: readonly DataTransformerConfig[],
  hidden: Iterable<string>,
  context: ColumnContext
): DataTransformerConfig[] {
  const normalized = normalizeColumnsEntry(configs, context);
  const catalog = new Set(context.catalog);
  const { hiddenColumns } = readColumnVisibility(normalized, context.frameFilter);
  const missingColumns = Array.from(hiddenColumns).filter((name) => !catalog.has(name));

  return withColumnReferences(
    encodeHiddenColumns(normalized, new Set([...missingColumns, ...hidden]), context.frameFilter),
    context
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
    const { hiddenColumns: storedHidden } = readColumnVisibility(current, getFrameFilter(sourceSeries, index));
    if (storedHidden.size === 0 || storedHidden.size < getVisibleFields(sourceSeries[index].fields).length) {
      return current;
    }
    const context = prepareColumnContext(sourceSeries, index);
    if (!context || context.catalog.length === 0) {
      return current;
    }
    const hiddenColumns = readHiddenColumns(current, context);
    if (context.catalog.some((name) => !hiddenColumns.has(name))) {
      return current;
    }

    // A refresh can leave only hidden columns. Reveal one so the table and its controls remain reachable.
    hiddenColumns.delete(context.catalog[0]);
    return writeHiddenColumns(current, hiddenColumns, context);
  }, transformations);
}

export const columnVisibility = {
  read: (configs, context) => ({
    hiddenColumns: new Set(toDisplayNames(context, readHiddenColumns(configs, context))),
  }),
  write: (configs, hidden, context) => writeHiddenColumns(configs, toCatalogNames(context, hidden), context),
} satisfies TableTransformation<{ hiddenColumns: ReadonlySet<string> }, ReadonlySet<string>, ColumnContext>;
