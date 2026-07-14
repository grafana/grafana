// Prototype-only. Not internationalized.
// Fake Prometheus query executor. Called instead of the real datasource
// backend so demos can hit "Run query" and see something believable in the
// graph/table without a live Prometheus server. Data is deterministic — same
// query and time range always produce the same series.

import { type Observable, of } from 'rxjs';

import {
  createDataFrame,
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  FieldType,
  LoadingState,
  type TimeRange,
} from '@grafana/data';

import { detectMetricInExpr, findMetric, type MetricType, type MockMetric } from './prometheusMockCatalog';

// Deterministic pseudo-noise so line shapes look natural but re-render identically.
function noise(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x); // [0, 1)
}

// Sine-shaped signal with a bit of noise. Bounded roughly to [min, max].
function wobble(seed: number, steps: number, min: number, max: number): number[] {
  const values: number[] = [];
  const amp = (max - min) / 2;
  const mid = (max + min) / 2;
  for (let i = 0; i < steps; i++) {
    const t = i / Math.max(1, steps - 1);
    const wave = Math.sin(2 * Math.PI * (t * 2 + seed * 0.11));
    const jitter = (noise(seed + 7, i) - 0.5) * 0.15;
    values.push(mid + amp * (wave + jitter));
  }
  return values;
}

// Ever-increasing counter — grows at ~1 per second with a small wobble.
function counterSeries(seed: number, startVal: number, times: number[]): number[] {
  const values: number[] = [];
  const startMs = times[0];
  const rate = 0.4 + noise(seed, 0) * 1.6; // 0.4 – 2.0 per sec
  for (let i = 0; i < times.length; i++) {
    const secs = (times[i] - startMs) / 1000;
    const drift = noise(seed, i) * 0.2 * rate;
    values.push(startVal + rate * secs + drift);
  }
  return values;
}

// Which PromQL wrapper (if any) sits at the outermost position? Rough parse:
// grab the leading identifier followed by "(".
function outerFunction(expr: string): string | null {
  const m = expr.trim().match(/^([a-zA-Z_]+)\s*\(/);
  return m?.[1] ?? null;
}

// How many series to fake for a given query. Histograms usually surface a few
// buckets; other metrics collapse to one (unless the expression obviously has
// a `by` clause).
function seriesCountFor(metric: MockMetric, expr: string): number {
  if (/\bby\s*\(/i.test(expr)) {
    return 3;
  }
  if (metric.type === 'histogram') {
    return 4;
  }
  return 1;
}

// Build a display name that mimics what real Prometheus would return.
function seriesDisplayName(metric: MockMetric, seriesIdx: number, outer: string | null): string {
  if (metric.type === 'histogram') {
    const buckets = ['0.005', '0.05', '0.5', '+Inf'];
    return `{le="${buckets[seriesIdx] ?? buckets[0]}"}`;
  }
  const instances = ['prod-api-01:9090', 'prod-api-02:9090', 'prod-api-03:9090'];
  if (outer) {
    return `{instance="${instances[seriesIdx % instances.length]}"}`;
  }
  return `{instance="${instances[seriesIdx % instances.length]}"}`;
}

function pickRange(type: MetricType, unit: string | undefined, outer: string | null, seriesIdx: number) {
  const isRate = outer === 'rate' || outer === 'irate';
  const isIncrease = outer === 'increase';
  const isQuantile = outer === 'histogram_quantile' || outer === 'quantile';

  if (isQuantile) {
    // Latencies: seconds, small-ish numbers.
    return { min: 0.01 * (seriesIdx + 1), max: 0.3 + 0.4 * seriesIdx };
  }
  if (isRate) {
    return { min: 0.1 + seriesIdx * 0.05, max: 2 + seriesIdx * 0.7 };
  }
  if (isIncrease) {
    return { min: 20 + seriesIdx * 8, max: 300 + seriesIdx * 40 };
  }
  if (type === 'gauge' && unit === 'bytes') {
    return { min: 2_000_000_000, max: 8_000_000_000 };
  }
  if (type === 'gauge') {
    return { min: 50, max: 250 };
  }
  if (type === 'summary') {
    return { min: 0.0001, max: 0.005 };
  }
  // histogram base or fallback
  return { min: 10, max: 100 };
}

function framesForExpr(expr: string, range: TimeRange, refId: string): DataFrame[] {
  const metric = detectMetricInExpr(expr) ?? findMetric(expr.trim());
  if (!metric) {
    return [];
  }

  const from = range.from.valueOf();
  const to = range.to.valueOf();
  const spanMs = Math.max(1, to - from);
  // ~60 points across the range (keeps the graph readable at any range).
  const steps = Math.min(200, Math.max(30, Math.round(spanMs / 30_000)));
  const stepMs = spanMs / (steps - 1);
  const times: number[] = [];
  for (let i = 0; i < steps; i++) {
    times.push(Math.round(from + i * stepMs));
  }

  const outer = outerFunction(expr);
  const isRawCounter = metric.type === 'counter' && !outer;
  const seriesCount = seriesCountFor(metric, expr);
  const frames: DataFrame[] = [];

  for (let s = 0; s < seriesCount; s++) {
    // Stable seed per (metric, series) so re-runs match.
    const seed = hashCode(`${metric.name}::${outer ?? ''}::${s}`) & 0xffff;

    let values: number[];
    if (isRawCounter) {
      values = counterSeries(seed, 100 + s * 250, times);
    } else {
      const { min, max } = pickRange(metric.type, metric.unit, outer, s);
      values = wobble(seed, steps, min, max);
    }

    const displayName = `${metric.name}${seriesDisplayName(metric, s, outer)}`;
    frames.push(
      createDataFrame({
        refId,
        name: displayName,
        fields: [
          { name: 'Time', type: FieldType.time, values: times },
          {
            name: 'Value',
            type: FieldType.number,
            values,
            config: { displayNameFromDS: displayName, unit: metric.unit },
          },
        ],
      })
    );
  }
  return frames;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function mockPrometheusQuery(request: DataQueryRequest): Observable<DataQueryResponse> {
  const data: DataFrame[] = [];
  for (const target of request.targets) {
    const expr = (target as { expr?: unknown }).expr;
    if (typeof expr !== 'string' || !expr.trim()) {
      continue;
    }
    data.push(...framesForExpr(expr, request.range, target.refId));
  }
  return of({ data, state: LoadingState.Done });
}
