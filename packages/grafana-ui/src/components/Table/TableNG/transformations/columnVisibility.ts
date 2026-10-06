import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';

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

export const columnVisibility = {
  read: (configs, { frameFilter }) => readColumnVisibility(configs, frameFilter),
  write: (configs, hidden, { frameFilter }) => encodeHiddenColumns(configs, hidden, frameFilter),
} satisfies TableTransformation<{ hiddenColumns: ReadonlySet<string> }, ReadonlySet<string>, ColumnContext>;
