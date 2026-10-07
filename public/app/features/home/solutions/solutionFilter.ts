import * as z from 'zod';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { contextSrv } from 'app/core/services/context_srv';

import { type SolutionId, type SolutionStats } from './types';

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

/** Stats for a scoped query that matched nothing. Null when the card runs unscoped: an empty fleet stays blank. */
export async function noMatchStats(
  filter: DatasourceBoundFilter | null,
  datasource: () => Promise<DataSourceInstanceListItem | null>,
  primary: string
): Promise<SolutionStats | null> {
  const ds = await datasource();
  return ds && scopeFor(filter, ds)
    ? { primary, secondary: t('home.solutions.filter.no-match-hint', 'Adjust the filters') }
    : null;
}
