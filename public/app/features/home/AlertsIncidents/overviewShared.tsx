import { css } from '@emotion/css';
import { type ReactNode } from 'react';
import { from, lastValueFrom } from 'rxjs';

import {
  CoreApp,
  type DataFrame,
  type DataSourceApi,
  type DataQuery,
  type DataQueryRequest,
  FieldType,
  generateUUID,
  getDefaultTimeRange,
  type GrafanaTheme2,
  rangeUtil,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';

// Datasources carry expr/instant/range on each target; model them on top of DataQuery so the
// request is fully typed without importing a plugin's query type.
interface InstantQueryTarget extends DataQuery {
  expr: string;
  instant: boolean;
  range: boolean;
}

export function readScalar(frames: DataFrame[], refId: string): number | null {
  const field = frames.find((f) => f.refId === refId)?.fields.find((f) => f.type === FieldType.number);
  const v = field && field.values.length ? field.values[field.values.length - 1] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function runInstantQueriesWithDataSource(
  ds: DataSourceApi,
  queries: Record<string, string>
): Promise<DataFrame[]> {
  const range = getDefaultTimeRange();
  const intervalInfo = rangeUtil.calculateInterval(range, 1);
  const targets: InstantQueryTarget[] = Object.entries(queries).map(([refId, expr]) => ({
    refId,
    expr,
    instant: true,
    range: false,
  }));
  const request: DataQueryRequest<InstantQueryTarget> = {
    requestId: `home-overview-${generateUUID()}`,
    interval: intervalInfo.interval,
    intervalMs: intervalInfo.intervalMs,
    range,
    scopedVars: {},
    timezone: 'UTC',
    app: CoreApp.Unknown,
    startTime: Date.now(),
    targets,
  };

  const result = await lastValueFrom(from(ds.query(request)));
  return result.data ?? [];
}

/**
 * Run a batch of instant queries against the default datasource of `dsType` (else the first) and
 * return the response frames. Throws (handled as a retryable error by callers) when none is
 * configured. The overview cards read single-value scalars off the result via {@link readScalar}.
 */
export async function runInstantQueries(dsType: string, queries: Record<string, string>): Promise<DataFrame[]> {
  const matches = getDataSourceSrv().getList({ type: dsType });
  const settings = matches.find((d) => d.isDefault) ?? matches[0];
  if (!settings) {
    throw new Error(`No ${dsType} datasource configured`);
  }
  const ds = await getDataSourceSrv().get(settings.uid);
  return runInstantQueriesWithDataSource(ds, queries);
}

/**
 * Run a batch of instant queries against explicit datasource UIDs and return scalar sums by refId.
 * This mirrors Grafana SLO overview dashboards, where each SLO can record into a different
 * Prometheus/Mimir datasource and the summary panels add the per-datasource results together.
 */
export async function runInstantQueriesForDataSourceUids(
  datasourceUids: string[],
  queries: Record<string, string>
): Promise<Record<string, number>> {
  const uniqueDatasourceUids = Array.from(new Set(datasourceUids.filter(Boolean)));
  if (uniqueDatasourceUids.length === 0) {
    throw new Error('No datasource configured');
  }

  const framesByDatasource = await Promise.all(
    uniqueDatasourceUids.map(async (uid) => {
      const ds = await getDataSourceSrv().get(uid);
      return runInstantQueriesWithDataSource(ds, queries);
    })
  );

  return Object.keys(queries).reduce<Record<string, number>>((acc, refId) => {
    acc[refId] = framesByDatasource.reduce((sum, frames) => sum + (readScalar(frames, refId) ?? 0), 0);
    return acc;
  }, {});
}

export type InsightSeverity = 'success' | 'warning' | 'error';

export function InsightRow({ severity, children }: { severity: InsightSeverity; children: NonNullable<ReactNode> }) {
  const styles = useStyles2(getInsightStyles);
  return (
    <Stack alignItems="center" gap={1}>
      <Icon name={severity === 'success' ? 'check-circle' : 'exclamation-triangle'} className={styles[severity]} />
      <Text color="secondary">{children}</Text>
    </Stack>
  );
}

const getInsightStyles = (theme: GrafanaTheme2) => ({
  success: css({ color: theme.colors.success.main }),
  warning: css({ color: theme.colors.warning.main }),
  error: css({ color: theme.colors.error.main }),
});
