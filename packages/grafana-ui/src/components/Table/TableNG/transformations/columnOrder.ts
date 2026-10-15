import { type DataTransformerConfig, type MatcherConfig } from '@grafana/data';
import { createOrderFieldsComparer } from '@grafana/data/internal';

import { EMPTY_OPTIONS, findColumnsEntry, writeColumnsEntry } from './organizeFields';
import { type ColumnContext, type TableTransformation } from './types';

/**
 * Stores a TableNG column order in the matching organize-fields transformation.
 * The complete order is recorded because the transformer places fields missing from its index map last.
 */
function encodeColumnOrder(
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
      columnOrder: Object.keys(indexByName).length ? mergeColumnOrder(catalog, indexByName) : undefined,
    };
  },
  write: (configs, order, { frameFilter }) => encodeColumnOrder(configs, order, frameFilter),
} satisfies TableTransformation<{ columnOrder: string[] | undefined }, string[], ColumnContext>;

function mergeColumnOrder(catalog: string[], indexByName: Record<string, number>): string[] {
  const known = new Set(catalog.filter((name) => Number.isInteger(indexByName[name])));
  if (known.size === 0) {
    return catalog;
  }

  const ordered = catalog.filter((name) => known.has(name)).sort(createOrderFieldsComparer(indexByName));
  let previousKnown: string | undefined;
  let added: string[] = [];

  for (const name of catalog) {
    if (!known.has(name)) {
      added.push(name);
      continue;
    }

    if (added.length > 0) {
      const anchor = previousKnown ?? name;
      const insertionIndex = ordered.indexOf(anchor) + (previousKnown ? 1 : 0);
      ordered.splice(insertionIndex, 0, ...added);
      added = [];
    }
    previousKnown = name;
  }

  if (added.length > 0 && previousKnown) {
    ordered.splice(ordered.indexOf(previousKnown) + 1, 0, ...added);
  }

  return ordered;
}
