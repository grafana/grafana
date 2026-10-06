import * as z from 'zod';

import {
  type AdHocVariableFilter,
  type DataSourceInstanceListItem,
  type MetricFindValue,
  rangeUtil,
} from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { type SolutionId } from './types';

/**
 * localStorage key of the current org's stored scope for a solution card (JSON of a
 * {@link DatasourceBoundFilter}). Datasource uids are unique per org, so the key carries the org id
 * like Explore's last-used datasource does; the browser profile is the user boundary.
 */
export function solutionFilterStorageKey(solution: SolutionId): string {
  return `grafana.home.${solution}.filter.${contextSrv.user.orgId}`;
}

/** A card scope is picked against one datasource and applies only while the card reads that one. */
export const DatasourceBoundFilterSchema = z.object({
  /** Datasource the values were picked from. */
  datasourceUid: z.string(),
  /** For the "not applied" message when the card resolves another datasource. */
  datasourceName: z.string(),
});

export type DatasourceBoundFilter = z.infer<typeof DatasourceBoundFilterSchema>;

/** Stored string lists: entries trimmed, blanks dropped (a blank regex alternative would match series lacking the label). */
export const TrimmedValues = z
  .array(z.string())
  .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ''));

/**
 * Stored JSON → filter. Null for a missing/malformed value or one that selects nothing: both mean
 * the card runs unscoped.
 */
export function parseStoredFilter<T extends DatasourceBoundFilter>(
  raw: string | undefined,
  schema: z.ZodType<T>,
  isEmpty: (filter: T) => boolean
): T | null {
  if (!raw) {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success && !isEmpty(result.data) ? result.data : null;
}

/** The filter scopes only the datasource it was saved for; any other datasource runs unscoped. */
export function scopeFor<T extends DatasourceBoundFilter>(
  filter: T | null,
  ds: Pick<DataSourceInstanceListItem, 'uid'>
): T | null {
  return filter && filter.datasourceUid === ds.uid ? filter : null;
}

// Matches the cards' "seen recently" lookback (24h inventory / sm_check_info).
const VALUES_RANGE = { from: 'now-24h', to: 'now' };

/**
 * Distinct `key` values carried by `metric` in datasource `uid` over the last 24h, narrowed by
 * `filters`. The Prometheus datasource caches label values per snapped time range itself
 * (1–60 min by cacheLevel), so reopening the dialog inside that window issues no request and a
 * moved window refreshes the list.
 */
export async function fetchFilterLabelValues(
  uid: string,
  key: string,
  metric: string,
  filters: AdHocVariableFilter[] = []
): Promise<string[]> {
  const ds = await getDataSourceInstance({ uid });
  if (!ds.getTagValues) {
    return [];
  }
  const query: PromQuery = { refId: 'values', expr: metric };
  const result = await ds.getTagValues({
    key,
    filters,
    timeRange: rangeUtil.convertRawToRange(VALUES_RANGE),
    queries: [query],
  });
  const values: MetricFindValue[] = Array.isArray(result) ? result : (result.data ?? []);
  return values.map((v) => String(v.value ?? v.text));
}
