import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';
import { createOrderFieldsComparer } from '@grafana/data/internal';

import { EMPTY_OPTIONS, findColumnsEntry, writeColumnsEntry } from './organizeFields';
import { type ColumnContext, type TableTransformation } from './types';

/**
 * Stores a TableNG column order in the matching organize-fields transformation.
 * The complete order is recorded because the transformer places fields missing from its index map last.
 */
export function encodeColumnOrder(
  transformations: readonly DataTransformerConfig[],
  order: string[],
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const indexByName = order.reduce<Record<string, number>>((acc, name, index) => {
    acc[name] = index;
    return acc;
  }, {});

  return writeColumnsEntry(
    transformations,
    { ...EMPTY_OPTIONS, ...findColumnsEntry(transformations, frameFilter)?.options, indexByName },
    frameFilter
  );
}

export const columnOrder = {
  read(configs, { catalog, frameFilter }) {
    const { indexByName = {} } = findColumnsEntry(configs, frameFilter)?.options ?? {};
    // Leave source order live until the user explicitly reorders.
    return {
      columnOrder: Object.keys(indexByName).length
        ? [...catalog].sort(createOrderFieldsComparer(indexByName))
        : undefined,
    };
  },
  write: (configs, order, { frameFilter }) => encodeColumnOrder(configs, order, frameFilter),
} satisfies TableTransformation<{ columnOrder: string[] | undefined }, string[], ColumnContext>;
