import {
  dateTime,
  FieldType,
  LoadingState,
  ThresholdsMode,
  toDataFrame,
  type DataFrame,
  type FieldConfigSource,
  type PanelData,
} from '@grafana/data';
import { SceneDataNode } from '@grafana/scenes';

/**
 * Why this module hand-builds sample frames instead of pointing each placeholder at a real query
 * against the TestData datasource, which would need none of the logic below:
 *
 *  - TestData is a core datasource, but nothing guarantees it's installed, enabled, or reachable
 *    on the instance a plan preview happens to run on — provisioning is an admin decision this
 *    feature doesn't control, and a preview can't depend on it to render at all.
 *  - A plan can scaffold many placeholder panels at once, and the preview is meant to render as
 *    soon as the plan does. A real query, even a synthetic one, is still a datasource round trip
 *    per panel; building frames in-process instead is materially faster at that scale and has no
 *    failure mode of its own to handle.
 *
 * The accepted cost of that choice: this sample data does not react to variable changes the way
 * a real query would, since there's no query underneath it to re-run. That's a known, priced
 * trade-off of a preview built this way, not an oversight — variables can still be reviewed,
 * added, renamed, or reordered while planning (see planningPolicy.ts), just without the panels
 * visibly responding until Build attaches real queries behind them.
 */

type PlanPreviewDataShape =
  | 'series'
  | 'categories'
  | 'single-value'
  | 'named-values'
  | 'table'
  | 'logs'
  | 'states'
  | 'scatter'
  | 'candles'
  | 'distribution'
  | 'none';
interface PlanVisualization {
  pluginId: string;
  data: PlanPreviewDataShape;
}

/** A rendered preview: everything a scenes `VizPanel` needs, with no datasource behind it. */
export interface MockPanelViz {
  data: PanelData;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

const POINT_COUNT = 60;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Build a self-contained preview for one planned panel.
 *
 * The numbers are synthetic but seeded off the panel title, so a given panel
 * looks the same on every render while neighbouring panels look different —
 * which is what makes the preview read as a dashboard rather than as the same
 * chart repeated. The signal's unit, range and series names are inferred from
 * the title too, so a "p99 latency" panel shows milliseconds and an "error
 * rate" panel shows a mostly-flat line with a spike.
 */
function buildMockPanelViz(title: string, viz: PlanVisualization): MockPanelViz {
  const random = seededRandom(title);
  const signal = inferSignal(title);
  const series = buildFrames(viz.data, signal, random);

  return {
    data: {
      state: LoadingState.Done,
      series,
      timeRange: {
        from: dateTime(Date.now() - WINDOW_MS),
        to: dateTime(Date.now()),
        raw: { from: 'now-1h', to: 'now' },
      },
    },
    options: buildOptions(viz, signal),
    fieldConfig: buildFieldConfig(viz, signal),
  };
}

interface Signal {
  unit: string;
  /** Typical value the series hovers around. */
  base: number;
  /** Fraction of `base` the series wanders by. */
  variance: number;
  /** A short burst partway through the window, for signals that spike. */
  spikes: boolean;
  min?: number;
  max?: number;
  seriesNames: string[];
}

const STATUS_CODES = ['200', '404', '500'];
const ENDPOINTS = ['/checkout', '/cart', '/search'];
const INSTANCES = ['pod-a1b2', 'pod-c3d4', 'pod-e5f6'];
const NODES = ['node-1', 'node-2', 'node-3'];

/**
 * Read the panel title for the signal it describes. Purely cosmetic — a wrong
 * guess degrades to a generic short-unit series.
 */
function inferSignal(title: string): Signal {
  const text = title.toLowerCase();
  const names = /status|code|response/.test(text)
    ? STATUS_CODES
    : /endpoint|route|path|handler|url/.test(text)
      ? ENDPOINTS
      : /node|host|server|instance/.test(text)
        ? NODES
        : INSTANCES;

  if (/latency|duration|p50|p90|p95|p99|response time|rtt/.test(text)) {
    return { unit: 'ms', base: 240, variance: 0.35, spikes: true, min: 0, max: 1000, seriesNames: names };
  }
  if (/error|fail|5xx|4xx|exception|crash|restart/.test(text)) {
    return { unit: 'short', base: 4, variance: 0.9, spikes: true, min: 0, max: 50, seriesNames: names };
  }
  if (/cpu/.test(text)) {
    return { unit: 'percentunit', base: 0.42, variance: 0.3, spikes: false, min: 0, max: 1, seriesNames: names };
  }
  if (/mem|heap|rss|cache|disk|storage|bytes/.test(text)) {
    return {
      unit: 'bytes',
      base: 640 * 1024 * 1024,
      variance: 0.18,
      spikes: false,
      min: 0,
      max: 2 * 1024 * 1024 * 1024,
      seriesNames: names,
    };
  }
  if (/saturation|utilization|utilisation|usage|ratio|percent|budget|availability|uptime/.test(text)) {
    return { unit: 'percent', base: 68, variance: 0.25, spikes: false, min: 0, max: 100, seriesNames: names };
  }
  if (/rate|rps|qps|throughput|request|traffic|ops|queries/.test(text)) {
    return { unit: 'reqps', base: 1250, variance: 0.22, spikes: false, min: 0, max: 4000, seriesNames: names };
  }
  if (/queue|backlog|lag|pending|depth/.test(text)) {
    return { unit: 'short', base: 130, variance: 0.6, spikes: true, min: 0, max: 800, seriesNames: names };
  }
  return { unit: 'short', base: 420, variance: 0.3, spikes: false, min: 0, max: 1000, seriesNames: names };
}

function buildFrames(shape: PlanPreviewDataShape, signal: Signal, random: () => number): DataFrame[] {
  switch (shape) {
    case 'series':
      return [seriesFrame(signal, random)];
    case 'single-value':
      return [singleValueFrame(signal, random)];
    case 'named-values':
      return [namedValuesFrame(signal, random)];
    case 'categories':
      return [categoriesFrame(signal, random)];
    case 'table':
      return [tableFrame(signal, random)];
    case 'logs':
      return [logsFrame(random)];
    case 'states':
      return [statesFrame(signal, random)];
    case 'scatter':
      return [scatterFrame(signal, random)];
    case 'candles':
      return [candlesFrame(signal, random)];
    case 'distribution':
      return [distributionFrame(signal, random)];
    case 'none':
      return [];
  }
}

function timestamps(): number[] {
  const end = Date.now();
  const step = WINDOW_MS / (POINT_COUNT - 1);
  return Array.from({ length: POINT_COUNT }, (_, i) => Math.round(end - WINDOW_MS + i * step));
}

/**
 * A wandering line: a slow sine drift plus noise, optionally interrupted by a
 * short burst. Clamped to the signal's range so units stay believable.
 */
function walk(signal: Signal, random: () => number, phase: number, scale: number): number[] {
  const spikeAt = Math.floor(POINT_COUNT * (0.55 + phase * 0.2));
  return Array.from({ length: POINT_COUNT }, (_, i) => {
    const drift = Math.sin(i / 9 + phase * Math.PI) * signal.variance * 0.5;
    const noise = (random() - 0.5) * signal.variance;
    const burst = signal.spikes && i >= spikeAt && i < spikeAt + 5 ? 1.8 + random() : 0;
    const value = signal.base * scale * (1 + drift + noise + burst);
    return clamp(round(value), signal.min, signal.max);
  });
}

function seriesFrame(signal: Signal, random: () => number): DataFrame {
  const time = timestamps();
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: time, config: {} },
      ...signal.seriesNames.map((name, index) => ({
        name,
        type: FieldType.number,
        values: walk(signal, random, index / signal.seriesNames.length, 1 - index * 0.22),
        config: { unit: signal.unit },
      })),
    ],
    length: time.length,
  });
}

/** Stat and gauge read the last value, but a time field also gives stat its sparkline. */
function singleValueFrame(signal: Signal, random: () => number): DataFrame {
  const time = timestamps();
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: time, config: {} },
      {
        name: signal.unit === 'percent' ? 'value' : 'current',
        type: FieldType.number,
        values: walk(signal, random, 0.3, 1),
        config: { unit: signal.unit, min: signal.min, max: signal.max },
      },
    ],
    length: time.length,
  });
}

function namedValuesFrame(signal: Signal, random: () => number): DataFrame {
  const names = [...signal.seriesNames, 'other'];
  const values = names.map((_, index) =>
    clamp(round(signal.base * (1 - index * 0.24) * (0.8 + random() * 0.4)), signal.min, signal.max)
  );
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'name', type: FieldType.string, values: names, config: {} },
      { name: 'value', type: FieldType.number, values, config: { unit: signal.unit } },
    ],
    length: names.length,
  });
}

function categoriesFrame(signal: Signal, random: () => number): DataFrame {
  const categories = signal.seriesNames.length >= 3 ? signal.seriesNames : ENDPOINTS;
  const values = categories.map(() => clamp(round(signal.base * (0.5 + random())), signal.min, signal.max));
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'category', type: FieldType.string, values: categories, config: {} },
      { name: 'value', type: FieldType.number, values, config: { unit: signal.unit } },
    ],
    length: categories.length,
  });
}

function tableFrame(signal: Signal, random: () => number): DataFrame {
  const rows = [...signal.seriesNames, 'other', 'total'];
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'name', type: FieldType.string, values: rows, config: {} },
      {
        name: 'value',
        type: FieldType.number,
        values: rows.map(() => clamp(round(signal.base * (0.5 + random())), signal.min, signal.max)),
        config: { unit: signal.unit },
      },
      {
        name: 'change',
        type: FieldType.number,
        values: rows.map(() => round((random() - 0.5) * 40)),
        config: { unit: 'percent' },
      },
    ],
    length: rows.length,
  });
}

const LOG_LINES = [
  'level=info msg="request completed" status=200 duration=42ms',
  'level=warn msg="upstream slow" status=200 duration=890ms',
  'level=error msg="upstream timeout" status=504 duration=3001ms',
  'level=info msg="cache hit" key=session ttl=300s',
  'level=info msg="request completed" status=204 duration=11ms',
  'level=error msg="connection refused" retry=2',
];

function logsFrame(random: () => number): DataFrame {
  const count = 12;
  const end = Date.now();
  const time = Array.from({ length: count }, (_, i) => end - (count - i) * 4000);
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'timestamp', type: FieldType.time, values: time, config: {} },
      {
        name: 'body',
        type: FieldType.string,
        values: time.map(() => LOG_LINES[Math.floor(random() * LOG_LINES.length)]),
        config: {},
      },
    ],
    length: count,
  });
}

const STATES = ['healthy', 'degraded', 'down'];

function statesFrame(signal: Signal, random: () => number): DataFrame {
  const count = 24;
  const end = Date.now();
  const step = WINDOW_MS / (count - 1);
  const time = Array.from({ length: count }, (_, i) => Math.round(end - WINDOW_MS + i * step));
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: time, config: {} },
      ...signal.seriesNames.map((name) => ({
        name,
        type: FieldType.string,
        // Weighted so the timeline reads as mostly-healthy with occasional trouble.
        values: time.map(() => STATES[random() > 0.86 ? (random() > 0.5 ? 2 : 1) : 0]),
        config: {},
      })),
    ],
    length: count,
  });
}

function scatterFrame(signal: Signal, random: () => number): DataFrame {
  const count = 40;
  const x = Array.from({ length: count }, (_, i) => round(i * (signal.base / count) * 2));
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'x', type: FieldType.number, values: x, config: {} },
      {
        name: 'y',
        type: FieldType.number,
        values: x.map((value) => clamp(round(value * (0.6 + random() * 0.8)), signal.min, signal.max)),
        config: { unit: signal.unit },
      },
    ],
    length: count,
  });
}

function candlesFrame(signal: Signal, random: () => number): DataFrame {
  const count = 30;
  const end = Date.now();
  const step = WINDOW_MS / (count - 1);
  const time = Array.from({ length: count }, (_, i) => Math.round(end - WINDOW_MS + i * step));
  const open: number[] = [];
  const close: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  let previous = signal.base;
  for (let i = 0; i < count; i++) {
    const next = clamp(round(previous * (0.94 + random() * 0.12)), signal.min, signal.max);
    open.push(previous);
    close.push(next);
    high.push(round(Math.max(previous, next) * 1.04));
    low.push(round(Math.min(previous, next) * 0.96));
    previous = next;
  }
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: time, config: {} },
      { name: 'open', type: FieldType.number, values: open, config: { unit: signal.unit } },
      { name: 'high', type: FieldType.number, values: high, config: { unit: signal.unit } },
      { name: 'low', type: FieldType.number, values: low, config: { unit: signal.unit } },
      { name: 'close', type: FieldType.number, values: close, config: { unit: signal.unit } },
    ],
    length: count,
  });
}

/** Histogram and trend both want a plain numeric x-axis rather than a time field. */
function distributionFrame(signal: Signal, random: () => number): DataFrame {
  const count = 40;
  const x = Array.from({ length: count }, (_, i) => i);
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'step', type: FieldType.number, values: x, config: {} },
      {
        name: 'value',
        type: FieldType.number,
        values: x.map((i) => {
          const bell = Math.exp(-(((i - count / 2) / (count / 5)) ** 2));
          return clamp(round(signal.base * bell * (0.7 + random() * 0.6)), signal.min, signal.max);
        }),
        config: { unit: signal.unit },
      },
    ],
    length: count,
  });
}

function buildOptions(viz: PlanVisualization, signal: Signal): Record<string, unknown> {
  switch (viz.pluginId) {
    case 'timeseries':
    case 'barchart':
    case 'candlestick':
    case 'trend':
    case 'xychart':
      return { legend: { showLegend: false }, tooltip: { mode: 'none' } };
    case 'stat':
      return {
        reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
        graphMode: 'area',
        colorMode: 'value',
        textMode: 'auto',
        justifyMode: 'auto',
      };
    case 'gauge':
      return { reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false }, showThresholdMarkers: true };
    case 'bargauge':
      return {
        reduceOptions: { calcs: [], fields: '/^value$/', values: true },
        displayMode: 'gradient',
        orientation: 'horizontal',
      };
    case 'piechart':
      return {
        reduceOptions: { calcs: [], fields: '/^value$/', values: true },
        pieType: 'donut',
        legend: { showLegend: false },
        tooltip: { mode: 'none' },
      };
    case 'heatmap':
      return { calculate: true, legend: { show: false }, tooltip: { show: false } };
    case 'state-timeline':
    case 'status-history':
      return { legend: { showLegend: false }, showValue: 'never' };
    case 'histogram':
      return { legend: { showLegend: false } };
    case 'logs':
      return { showTime: true, wrapLogMessage: false, enableLogDetails: false, sortOrder: 'Descending' };
    case 'table':
      return { showHeader: true, footer: { show: false } };
    case 'text':
      return {
        mode: 'markdown',
        content: `_${signal.unit === 'short' ? 'Context and links for this section.' : 'Notes for this section.'}_`,
      };
    default:
      return {};
  }
}

function buildFieldConfig(viz: PlanVisualization, signal: Signal): FieldConfigSource {
  const defaults: FieldConfigSource['defaults'] = {
    unit: signal.unit,
    color: { mode: viz.data === 'single-value' ? 'thresholds' : 'palette-classic' },
    ...(signal.min !== undefined ? { min: signal.min } : {}),
    ...(signal.max !== undefined ? { max: signal.max } : {}),
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: signal.max !== undefined ? signal.max * 0.8 : signal.base * 2, color: 'red' },
      ],
    },
  };

  if (viz.pluginId === 'timeseries') {
    return {
      defaults: {
        ...defaults,
        custom: { drawStyle: 'line', lineWidth: 1, fillOpacity: 12, showPoints: 'never', spanNulls: true },
      },
      overrides: [],
    };
  }
  if (viz.pluginId === 'barchart') {
    return { defaults: { ...defaults, custom: { lineWidth: 1, fillOpacity: 80 } }, overrides: [] };
  }
  return { defaults, overrides: [] };
}

function clamp(value: number, min?: number, max?: number): number {
  const lower = min !== undefined ? Math.max(value, min) : value;
  return max !== undefined ? Math.min(lower, max) : lower;
}

function round(value: number): number {
  return Math.abs(value) >= 1000 ? Math.round(value) : Math.round(value * 100) / 100;
}

/** mulberry32 seeded off the title, so a panel's preview is stable across renders. */
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_SHAPES: Record<string, PlanPreviewDataShape> = {
  timeseries: 'series',
  stat: 'single-value',
  gauge: 'single-value',
  bargauge: 'named-values',
  barchart: 'categories',
  table: 'table',
  logs: 'logs',
  heatmap: 'series',
  piechart: 'named-values',
  'state-timeline': 'states',
  'status-history': 'states',
  histogram: 'distribution',
  trend: 'distribution',
  xychart: 'scatter',
  candlestick: 'candles',
  text: 'none',
};

export function getPlanningPanelData(title: string, pluginId: string) {
  const data = SAMPLE_SHAPES[pluginId] ?? 'series';
  const sample = buildMockPanelViz(title, { pluginId, data });
  return { $data: new SceneDataNode({ data: sample.data }), options: sample.options, fieldConfig: sample.fieldConfig };
}

/**
 * A few generic sample values for a stand-in variable in a plan preview -- the same job as the
 * panel sample data above (making a query-less preview look plausible), for a variable that has
 * no real datasource behind it yet. Deliberately generic rather than name-derived: a plan names
 * only the variable (e.g. "cluster"), not what its values should look like, and generic
 * placeholders are honest about being a preview rather than guessing real-looking ones.
 */
export function getPlanningVariableValues(): string[] {
  return ['value-1', 'value-2', 'value-3'];
}
