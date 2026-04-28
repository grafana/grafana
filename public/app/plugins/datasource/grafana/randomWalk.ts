import { type DataFrame, DataFrameType, type DataQueryRequest, FieldType } from '@grafana/data';

import { type GrafanaQuery } from './types';

const MAX_POINTS = 10000;

/**
 * Generate random walk time series data client-side.
 * Port of pkg/tsdb/grafana-testdata-datasource/scenarios.go RandomWalk().
 */
export function randomWalk(query: GrafanaQuery, request: DataQueryRequest<GrafanaQuery>): DataFrame[] {
  const seriesCount = query.seriesCount ?? 1;
  const spread = query.spread ?? 1;
  const startValue = query.startValue ?? Math.random() * 100;
  const noise = query.noise ?? 0;
  const drop = (query.dropPercent ?? 0) / 100;

  const hasMin = query.min != null;
  const hasMax = query.max != null;
  const minVal = query.min ?? 0;
  const maxVal = query.max ?? 0;

  const fromMs = request.range.from.valueOf();
  const toMs = request.range.to.valueOf();
  const intervalMs = request.intervalMs;

  const frames: DataFrame[] = [];

  for (let si = 0; si < seriesCount; si++) {
    const timeValues: number[] = [];
    const floatValues: Array<number | null> = [];

    let walker = startValue;
    let timeWalkerMs = fromMs;

    for (let i = 0; i < MAX_POINTS && timeWalkerMs < toMs; i++) {
      let nextValue = walker + Math.random() * noise;

      if (hasMin && nextValue < minVal) {
        nextValue = minVal;
        walker = minVal;
      }

      if (hasMax && nextValue > maxVal) {
        nextValue = maxVal;
        walker = maxVal;
      }

      if (drop > 0 && Math.random() < drop) {
        // skip value
      } else {
        timeValues.push(timeWalkerMs);
        floatValues.push(nextValue);
      }

      walker += (Math.random() - 0.5) * spread;
      timeWalkerMs += intervalMs;
    }

    const suffix = si > 0 ? String(si) : '';
    const seriesName = `${query.refId}-series${suffix}`;

    frames.push({
      fields: [
        { name: 'time', type: FieldType.time, values: timeValues, config: { interval: intervalMs } },
        { name: seriesName, type: FieldType.number, values: floatValues, config: {} },
      ],
      length: timeValues.length,
      meta: { type: DataFrameType.TimeSeriesMulti },
    });
  }

  return frames;
}
