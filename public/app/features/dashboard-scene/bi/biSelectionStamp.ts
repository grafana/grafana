import { type AdHocFilterWithLabels } from '@grafana/scenes';

/**
 * Marks an ad hoc filter as a BI selection written by a panel click (session-only, stripped on save and
 * absent from the URL). `values` is a copy of what was written, so a later edit of the filter's value
 * invalidates the stamp and the filter becomes an ordinary filter.
 */
export interface BiSelectionStamp {
  sourcePanel: string;
  values: string[];
}

/**
 * Returns the filter's BI selection stamp when it still describes the filter, otherwise undefined.
 */
export function getValidBiSelection(filter: AdHocFilterWithLabels): BiSelectionStamp | undefined {
  const stamp = getMeta(filter)?.biSelection;
  if (!isBiSelectionStamp(stamp) || filter.origin || filter.readOnly) {
    return undefined;
  }

  let current: string[];
  if (filter.operator === '=') {
    current = [filter.value];
  } else if (filter.operator === '=|') {
    current = filter.values ?? [];
  } else {
    return undefined;
  }

  const matches = current.length === stamp.values.length && current.every((value, i) => value === stamp.values[i]);
  return matches ? stamp : undefined;
}

/**
 * Returns the filter without `meta.biSelection`, leaving the input untouched. Other `meta` keys are kept.
 */
export function stripBiSelectionStamp(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  const filterMeta = getMeta(filter);
  if (!filterMeta || !('biSelection' in filterMeta)) {
    return filter;
  }

  const { biSelection: _biSelection, ...meta } = filterMeta;
  const { meta: _meta, ...rest } = filter;
  return Object.keys(meta).length > 0 ? { ...rest, meta } : rest;
}

function getMeta(filter: AdHocFilterWithLabels): Record<string, unknown> | undefined {
  return filter.meta;
}

function isBiSelectionStamp(value: unknown): value is BiSelectionStamp {
  if (typeof value !== 'object' || value === null || !('sourcePanel' in value) || !('values' in value)) {
    return false;
  }

  const { sourcePanel, values } = value;
  return (
    typeof sourcePanel === 'string' && Array.isArray(values) && values.every((v): v is string => typeof v === 'string')
  );
}
