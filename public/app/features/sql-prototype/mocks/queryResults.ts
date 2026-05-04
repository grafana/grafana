import { DataFrame, FieldType, MutableDataFrame } from '@grafana/data';

const NOW = Date.now();
const STEP = 5 * 60 * 1000; // 5 min step
const POINTS = 72; // 6 hours of 5-min data

function makeTimestamps(): number[] {
  return Array.from({ length: POINTS }, (_, i) => NOW - (POINTS - i) * STEP);
}

function makeFrame(name: string, fields: Array<{ name: string; values: number[] }>): DataFrame {
  const frame = new MutableDataFrame({ name, fields: [] });
  frame.addField({ name: 'time', type: FieldType.time, values: makeTimestamps() });
  for (const f of fields) {
    frame.addField({ name: f.name, type: FieldType.number, values: f.values });
  }
  return frame;
}

function sine(amp: number, period: number, offset = 0): number[] {
  return makeTimestamps().map((_, i) => amp + amp * 0.5 * Math.sin((2 * Math.PI * i) / period + offset));
}

function noise(base: number, range: number): number[] {
  return makeTimestamps().map(() => base + Math.random() * range);
}

function histogramQuantileResult(): DataFrame[] {
  const leValues = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
  const frames: DataFrame[] = [];

  for (const le of leValues) {
    const vals = sine(le * 0.8, 30, le).map((v) => Math.max(0, v));
    frames.push(
      makeFrame(`le=${le}`, [{ name: 'p95_latency', values: vals }])
    );
  }
  return frames;
}

function rateResult(): DataFrame[] {
  return [
    makeFrame('http_rate', [{ name: 'req_per_sec', values: sine(120, 40, 0) }]),
    makeFrame('error_rate', [{ name: 'req_per_sec', values: noise(3, 2) }]),
  ];
}

function countResult(): DataFrame {
  return makeFrame('total_requests', [{ name: 'count', values: sine(10000, 36, 1) }]);
}

function defaultTimeseries(): DataFrame[] {
  return [
    makeFrame('A-series', [{ name: 'value', values: sine(50, 20, 0) }]),
    makeFrame('B-series', [{ name: 'value', values: sine(30, 15, 1.5) }]),
  ];
}

export function simulateQuery(sql: string): DataFrame[] {
  const lower = sql.toLowerCase();

  if (/histogram_quantile/.test(lower)) {
    return histogramQuantileResult();
  }
  if (/rate\s*\(/.test(lower)) {
    return rateResult();
  }
  if (/count\s*\(/.test(lower) || /count_over_time/.test(lower)) {
    return [countResult()];
  }
  return defaultTimeseries();
}

export function getQuerySummary(frames: DataFrame[]): {
  rowCount: number;
  seriesCount: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
} {
  let total = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  let rowCount = 0;

  for (const frame of frames) {
    rowCount += frame.length;
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        for (let i = 0; i < field.values.length; i++) {
          const v = (field.values as number[])[i];
          if (v != null && !isNaN(v)) {
            total += v;
            count++;
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        }
      }
    }
  }

  return {
    rowCount,
    seriesCount: frames.length,
    minValue: min === Infinity ? 0 : +min.toFixed(4),
    maxValue: max === -Infinity ? 0 : +max.toFixed(4),
    avgValue: count > 0 ? +(total / count).toFixed(4) : 0,
  };
}
