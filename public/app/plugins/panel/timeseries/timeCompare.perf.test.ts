import {
  alignTimeRangeCompareData,
  createDataFrame,
  createTheme,
  type DataFrame,
  dateTime,
  FieldType,
  shouldAlignTimeCompare,
  type TimeRange,
} from '@grafana/data';

import { prepareGraphableFields } from './utils';

/**
 * TimeComparison performance benchmark (#125104)
 *
 * A manual timing + heap benchmark that automates the 4-panel harness the team used while
 * investigating time-comparison memory use (#126185 / PR #129681). It runs the same
 * data-preparation pipeline as `TimeSeriesPanel` (`prepareGraphableFields` then compare-frame
 * alignment) over harness-shaped scenarios and reports data-prep time, retained heap, and prepared
 * point counts. The reported time is prep-only: it excludes the datasource query and the uPlot draw,
 * so use the Playwright baseline (e2e-playwright/panels-suite/timeCompare-perf.spec.ts) for end-to-end
 * query + render numbers.
 * The `Dashboard Nx compare` scenario runs the pipeline for N panels at once to model a dashboard.
 *
 * It lives next to the other time-compare tests but is SKIPPED by default so its non-deterministic
 * timing/heap never runs (or flakes) in CI. It reuses jest purely for module resolution, so it
 * always measures current source without extra tooling.
 *
 * Run it manually (heap numbers are most stable with GC exposed):
 *
 *   RUN_TIMECOMPARE_BENCH=1 node --expose-gc node_modules/.bin/jest \
 *     public/app/plugins/panel/timeseries/timeCompare.perf.test.ts --runInBand --no-coverage
 *
 * Tunables via env: SERIES, WINDOW_HOURS, INTERVAL_SEC, OFFSET_HOURS, ITERATIONS.
 * Defaults mirror the harness: 500 series, 6h window, 20s interval, 24h offset.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const intEnv = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const SERIES = intEnv('SERIES', 500);
const WINDOW_MS = intEnv('WINDOW_HOURS', 6) * HOUR;
const INTERVAL_MS = intEnv('INTERVAL_SEC', 20) * SECOND;
const OFFSET_MS = intEnv('OFFSET_HOURS', 24) * HOUR;
const ITERATIONS = intEnv('ITERATIONS', 7);
// Panels rendered simultaneously in the "dashboard of compare panels" scenario. Each panel runs the
// full compare pipeline and its output is retained at once, so heap reflects the whole dashboard.
const PANELS = intEnv('PANELS', 12);
const WARMUP = 2;

const NOW = 1_700_000_000_000; // fixed epoch for reproducible timestamps

const theme = createTheme();

function makeTimeRange(from: number, to: number): TimeRange {
  return { from: dateTime(from), to: dateTime(to), raw: { from: dateTime(from), to: dateTime(to) } };
}

function timeValues(from: number, to: number, interval: number): number[] {
  const out: number[] = [];
  for (let t = from; t <= to; t += interval) {
    out.push(t);
  }
  return out;
}

function makeSeriesFrames(
  count: number,
  refId: string,
  windowFrom: number,
  windowTo: number,
  compare: boolean
): DataFrame[] {
  const times = timeValues(windowFrom, windowTo, INTERVAL_MS);
  return Array.from({ length: count }, (_, i) =>
    createDataFrame({
      refId,
      meta: compare ? { timeCompare: { isTimeShiftQuery: true, diffMs: -OFFSET_MS } } : undefined,
      fields: [
        { name: 'time', type: FieldType.time, config: { interval: INTERVAL_MS }, values: times.slice() },
        {
          name: `${refId}-series${i}`,
          type: FieldType.number,
          config: { custom: {} },
          values: times.map((_, idx) => Math.sin((idx + i) / 7) * 100),
        },
      ],
    })
  );
}

// Mirrors TimeSeriesPanel: prepare graphable fields, then align compare frames.
function runPipeline(series: DataFrame[], timeRange: TimeRange): DataFrame[] {
  const prepared = prepareGraphableFields(series, theme, timeRange);
  if (!prepared) {
    throw new Error('prepareGraphableFields returned null for benchmark scenario');
  }
  return prepared.map((frame) => {
    const diffMs = frame.meta?.timeCompare?.diffMs ?? 0;
    if (diffMs !== 0 && shouldAlignTimeCompare(frame, prepared, timeRange)) {
      return alignTimeRangeCompareData(frame, diffMs, theme);
    }
    return frame;
  });
}

function preparedPoints(frames: DataFrame[]): number {
  return frames.reduce((sum, f) => sum + f.length * (f.fields.length - 1), 0);
}

const currentRange = makeTimeRange(NOW - WINDOW_MS, NOW);
const shiftedRange = makeTimeRange(NOW - WINDOW_MS - OFFSET_MS, NOW - OFFSET_MS);

interface Scenario {
  label: string;
  source: () => DataFrame[];
  range: TimeRange;
  series: number;
  // Number of independent panels running this pipeline at once (default 1). >1 models a dashboard.
  panels?: number;
}

const scenarios: Record<string, Scenario> = {
  baseline1x: {
    label: 'Baseline 1x',
    source: () => makeSeriesFrames(SERIES, 'A', NOW - WINDOW_MS, NOW, false),
    range: currentRange,
    series: SERIES,
  },
  baseline2x: {
    label: 'Baseline 2x',
    source: () => makeSeriesFrames(2 * SERIES, 'A', NOW - WINDOW_MS, NOW, false),
    range: currentRange,
    series: 2 * SERIES,
  },
  timeshift: {
    label: 'Timeshift',
    source: () => makeSeriesFrames(SERIES, 'A', NOW - WINDOW_MS - OFFSET_MS, NOW - OFFSET_MS, false),
    range: shiftedRange,
    series: SERIES,
  },
  compare: {
    label: 'Compare',
    source: () => [
      ...makeSeriesFrames(SERIES, 'A', NOW - WINDOW_MS, NOW, false),
      ...makeSeriesFrames(SERIES, 'A-compare', NOW - WINDOW_MS - OFFSET_MS, NOW - OFFSET_MS, true),
    ],
    range: currentRange,
    series: SERIES,
  },
  dashboardCompare: {
    label: `Dashboard ${PANELS}x compare`,
    source: () => [
      ...makeSeriesFrames(SERIES, 'A', NOW - WINDOW_MS, NOW, false),
      ...makeSeriesFrames(SERIES, 'A-compare', NOW - WINDOW_MS - OFFSET_MS, NOW - OFFSET_MS, true),
    ],
    range: currentRange,
    series: SERIES,
    panels: PANELS,
  },
};

const SCENARIO_KEYS = ['baseline1x', 'baseline2x', 'timeshift', 'compare', 'dashboardCompare'];

function gc(): void {
  const maybeGc = (globalThis as { gc?: () => void }).gc;
  if (typeof maybeGc === 'function') {
    maybeGc();
  }
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Total prep time to render the scenario: sum of every panel's pipeline. For single-panel scenarios
// panels=1, so this is just that panel; for the dashboard scenario it is the whole dashboard.
function measureTimeMs(scenario: Scenario): number {
  const panels = scenario.panels ?? 1;
  const timings: number[] = [];
  for (let i = 0; i < WARMUP + ITERATIONS; i++) {
    const start = performance.now();
    let produced = 0;
    for (let p = 0; p < panels; p++) {
      const result = runPipeline(scenario.source(), scenario.range);
      produced += result.length;
    }
    const elapsed = performance.now() - start;
    if (produced === 0) {
      throw new Error('empty pipeline result');
    }
    if (i >= WARMUP) {
      timings.push(elapsed);
    }
  }
  return median(timings);
}

function measureRetainedHeap(scenario: Scenario): { bytes: number; points: number } {
  // Total heap retained while the scenario is on screen: source frames + prepared/aligned output for
  // every panel, all held at once. Building inside the measured region matters because
  // baseline/timeshift pass frames through without new allocation, so only the compare path allocates
  // on top of its source. Retaining every panel's output models a dashboard's concurrent footprint.
  const panels = scenario.panels ?? 1;
  gc();
  const before = process.memoryUsage().heapUsed;
  const held: DataFrame[][] = [];
  for (let p = 0; p < panels; p++) {
    held.push(runPipeline(scenario.source(), scenario.range));
  }
  gc();
  const after = process.memoryUsage().heapUsed;
  const points = held.reduce((sum, frames) => sum + preparedPoints(frames), 0);
  if (held.length < 0) {
    throw new Error('unreachable'); // keep output referenced past the measurement
  }
  return { bytes: Math.max(0, after - before), points };
}

const RUN_BENCH = process.env.RUN_TIMECOMPARE_BENCH === '1';
// Skipped in CI by default; opt in with RUN_TIMECOMPARE_BENCH=1.
const benchDescribe = RUN_BENCH ? describe : describe.skip;

benchDescribe('TimeComparison performance benchmark (#125104)', () => {
  it('reports time, heap, and prepared points for the harness scenarios', () => {
    const gcOn = typeof (globalThis as { gc?: () => void }).gc === 'function';
    const fmtMB = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);

    const results: Record<string, { time: number; heap: number; points: number }> = {};
    for (const key of SCENARIO_KEYS) {
      const s = scenarios[key];
      const time = measureTimeMs(s);
      const { bytes, points } = measureRetainedHeap(s);
      results[key] = { time, heap: bytes, points };
    }

    const base = results.baseline1x;
    const widths = [22, 8, 8, 14, 13, 11, 13, 13];
    const header = [
      'Scenario',
      'Series',
      'Panels',
      'Prepared pts',
      'Prep Time(ms)',
      'Heap (MB)',
      'pts vs base',
      'heap vs base',
    ];
    const lines = [
      'TimeComparison performance benchmark (#125104)',
      `series=${SERIES} window=${WINDOW_MS / HOUR}h interval=${INTERVAL_MS / SECOND}s offset=${OFFSET_MS / HOUR}h ` +
        `panels=${PANELS} iterations=${ITERATIONS} gc=${gcOn ? 'on' : 'OFF (run node --expose-gc for stable heap)'}`,
      'Pipeline: prepareGraphableFields + compare alignment (data prep only; excludes uPlot/query/render)',
      '',
      header.map((h, i) => h.padEnd(widths[i])).join(''),
    ];
    for (const key of SCENARIO_KEYS) {
      const s = scenarios[key];
      const r = results[key];
      lines.push(
        [
          s.label,
          s.series,
          s.panels ?? 1,
          r.points,
          r.time.toFixed(3),
          fmtMB(r.heap),
          (r.points / base.points).toFixed(2) + 'x',
          base.heap ? (r.heap / base.heap).toFixed(2) + 'x' : '-',
        ]
          .map((v, i) => String(v).padEnd(widths[i]))
          .join('')
      );
    }
    // Write directly to stdout: this repo's jest setup fails tests that call console.log.
    process.stdout.write(lines.join('\n') + '\n');

    // Loose guard so the run fails loudly if the pipeline silently no-ops; the report above is the point.
    expect(results.compare.points).toBeGreaterThan(results.baseline1x.points);
  });
});
