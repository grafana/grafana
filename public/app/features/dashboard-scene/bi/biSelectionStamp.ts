import { type AdHocFilterWithLabels } from '@grafana/scenes';

/**
 * Marks an ad hoc filter as a BI selection written by a panel click. It is stripped on save; the URL carries only
 * the owner and key (see BiSelectionUrlSync). `values` is a copy of what was written, so a later edit of the filter's
 * value invalidates the stamp and the filter becomes an ordinary filter.
 */
export interface BiSelectionStamp {
  sourcePanel: string;
  /** The filter key that was written; editing a pill's key invalidates the stamp */
  key: string;
  values: string[];
}

/**
 * Returns the filter's BI selection stamp when it still describes the filter, otherwise undefined.
 */
export function getValidBiSelection(filter: AdHocFilterWithLabels): BiSelectionStamp | undefined {
  const stamp = getMeta(filter)?.biSelection;
  if (!isBiSelectionStamp(stamp) || stamp.key !== filter.key || filter.origin || filter.readOnly) {
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
 * Whether a filter can hold a BI selection: an editable `=` or `=|` filter that was not injected.
 */
export function isBiSelectable(filter: AdHocFilterWithLabels): boolean {
  return (filter.operator === '=' || filter.operator === '=|') && !filter.origin && !filter.readOnly;
}

/**
 * Returns a copy of a selectable filter stamped as owned by `sourcePanel` with its current values.
 */
export function stampBiSelection(filter: AdHocFilterWithLabels, sourcePanel: string): AdHocFilterWithLabels {
  const values = filter.operator === '=|' ? [...(filter.values ?? [])] : [filter.value];
  return { ...filter, meta: { ...getMeta(filter), biSelection: { sourcePanel, key: filter.key, values } } };
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

/**
 * Whether two filters send the same expression (key, operator and values), ignoring labels and metadata.
 */
export function haveSameExpression(
  a: Pick<AdHocFilterWithLabels, 'key' | 'operator' | 'value' | 'values'>,
  b: Pick<AdHocFilterWithLabels, 'key' | 'operator' | 'value' | 'values'>
): boolean {
  const aValues = a.values ?? [];
  const bValues = b.values ?? [];
  return (
    a.key === b.key &&
    a.operator === b.operator &&
    a.value === b.value &&
    aValues.length === bValues.length &&
    aValues.every((value, i) => value === bValues[i])
  );
}

/**
 * When `filters` holds a BI selection with the same expression as `filter`, returns `filters` with that selection
 * released (see releaseBiSelectionStamp), so it becomes an ordinary filter for every panel. Otherwise returns
 * undefined.
 *
 * Scenes deduplicates identical filters, so adding a manual filter next to an identical selection would leave only one
 * of them, and the selecting panel would then skip a filter the user added by hand.
 */
export function releaseIdenticalBiSelection(
  filters: AdHocFilterWithLabels[],
  filter: Pick<AdHocFilterWithLabels, 'key' | 'operator' | 'value' | 'values'>
): AdHocFilterWithLabels[] | undefined {
  const index = filters.findIndex((f) => getValidBiSelection(f) && haveSameExpression(f, filter));
  if (index < 0) {
    return undefined;
  }

  const next = filters.slice();
  next.splice(index, 1, releaseBiSelectionStamp(filters[index]));
  return next;
}

/**
 * Returns the filter with its stamp replaced by `null`: an ordinary filter that remembers it was deliberately released,
 * so URL ownership sync does not stamp it again. Saving strips the marker like a stamp.
 */
export function releaseBiSelectionStamp(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  return { ...filter, meta: { ...getMeta(filter), biSelection: null } };
}

/**
 * Whether the filter carries BI selection metadata at all, valid or not. A filter replaced from the URL has none; an
 * edited, released or re-keyed selection keeps its stale metadata.
 */
export function hasBiSelectionMeta(filter: AdHocFilterWithLabels): boolean {
  const meta = getMeta(filter);
  return Boolean(meta && 'biSelection' in meta);
}

function getMeta(filter: AdHocFilterWithLabels): Record<string, unknown> | undefined {
  return filter.meta;
}

function isBiSelectionStamp(value: unknown): value is BiSelectionStamp {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('sourcePanel' in value) ||
    !('key' in value) ||
    !('values' in value)
  ) {
    return false;
  }

  const { sourcePanel, key, values } = value;
  return (
    typeof sourcePanel === 'string' &&
    typeof key === 'string' &&
    Array.isArray(values) &&
    values.every((v): v is string => typeof v === 'string')
  );
}
