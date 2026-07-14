import { firstValueFrom, timeout } from 'rxjs';
import { first } from 'rxjs/operators';

import {
  type DataFrame,
  type DataSourceInstanceSettings,
  dateTime,
  type Field,
  type FieldSparkline,
  FieldType,
  getDefaultTimeRange,
  getMinMaxAndDelta,
  LoadingState,
  type TimeRange,
} from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { createQueryRunner } from '@grafana/runtime';

export function readScalar(frames: DataFrame[], refId: string): number | null {
  const field = frames.find((f) => f.refId === refId)?.fields.find((f) => f.type === FieldType.number);
  const v = field && field.values.length ? field.values[field.values.length - 1] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Extract the first usable time series for `refId` as a sparkline input. Requires a real series
// (> 1 point) so a single-point instant/vector frame is rejected; skips frames whose time/number
// fields are absent or length-mismatched rather than trusting the first refId match.
export function readSeries(frames: DataFrame[], refId: string): FieldSparkline | null {
  for (const frame of frames) {
    if (frame.refId !== refId) {
      continue;
    }
    const x: Field | undefined = frame.fields.find((f) => f.type === FieldType.time);
    const y: Field | undefined = frame.fields.find((f) => f.type === FieldType.number);
    if (x && y && y.values.length > 1 && x.values.length === y.values.length) {
      // Sparkline's getYRange reads y.state.range; raw query frames lack it (no field-overrides
      // pass), so populate it here or uPlot throws destructuring an undefined range.
      const yWithRange: Field = { ...y, state: { ...y.state, range: getMinMaxAndDelta(y) } };
      return { x, y: yWithRange };
    }
  }
  return null;
}

/**
 * Run PromQL through the shared {@link createQueryRunner | QueryRunner} against `ds` — core plumbing
 * owns request building, interval math, and frame conversion, and the Prometheus datasource always
 * answers with DataFrames. Throws (surfaced as an error; callers omit the entry) when the query
 * errors or times out.
 */
async function runPromQueries(
  queries: PromQuery[],
  range: TimeRange,
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<DataFrame[]> {
  const runner = createQueryRunner();
  try {
    runner.run({
      datasource: { uid: ds.uid, type: ds.type },
      queries,
      timeRange: range,
      timezone: 'utc',
      maxDataPoints: 60, // stable step regardless of datasource default
      minInterval: null,
    });
    // If the runner never emits a terminal state (e.g. its internal datasource lookup rejects),
    // time out instead of leaving callers' useAsync in a permanent loading state.
    const data = await firstValueFrom(
      runner.get().pipe(
        first((d) => d.state === LoadingState.Done || d.state === LoadingState.Error),
        timeout(30_000)
      )
    );
    if (data.state === LoadingState.Error) {
      throw new Error(data.errors?.[0]?.message ?? data.error?.message ?? 'Prometheus query failed');
    }
    return data.series;
  } finally {
    runner.destroy();
  }
}

/**
 * Run a batch of instant queries (refId -> PromQL) and return the response frames. The overview
 * cards read single-value scalars off the result via {@link readScalar}.
 */
export async function runInstantQueries(
  queries: Record<string, string>,
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<DataFrame[]> {
  const targets: PromQuery[] = Object.entries(queries).map(([refId, expr]) => ({
    refId,
    expr,
    instant: true,
    range: false,
  }));
  return runPromQueries(targets, getDefaultTimeRange(), ds);
}

/**
 * Run a single range query over the last `hours` and return the response frames. Callers read a
 * series off the result via {@link readSeries}.
 */
export async function runRangeQuery(
  refId: string,
  expr: string,
  hours: number,
  ds: Pick<DataSourceInstanceSettings, 'uid' | 'type'>
): Promise<DataFrame[]> {
  const toTime = dateTime();
  const fromTime = dateTime().subtract(hours, 'h');
  const range: TimeRange = { from: fromTime, to: toTime, raw: { from: `now-${hours}h`, to: 'now' } };
  return runPromQueries([{ refId, expr, instant: false, range: true }], range, ds);
}
