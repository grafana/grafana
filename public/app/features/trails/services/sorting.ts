import { OutlierDetector, OutlierOutput } from '@bsull/augurs/outlier';
import { memoize } from 'lodash';

import { DataFrame, doStandardCalcs, fieldReducers, FieldType, outerJoinDataFrames, ReducerID } from '@grafana/data';

import { reportExploreMetrics } from '../interactions';

import { getLabelValueFromDataFrame } from './levels';

export const sortSeries = memoize(
  (series: DataFrame[], sortBy: string, direction = 'asc') => {
    if (sortBy === 'alphabetical') {
      return sortSeriesByName(series, 'asc');
    }

    if (sortBy === 'alphabetical-reversed') {
      return sortSeriesByName(series, 'desc');
    }

    if (sortBy === 'outliers') {
      initOutlierDetector(series);
    }

    const reducer = (dataFrame: DataFrame) => {
      try {
        if (sortBy === 'outliers') {
          return calculateOutlierValue(series, dataFrame);
        }
      } catch (e) {
        console.error(e);
        // ML sorting panicked, fallback to stdDev
        sortBy = ReducerID.stdDev;
      }
      const fieldReducer = fieldReducers.get(sortBy);
      const value =
        fieldReducer.reduce?.(dataFrame.fields[1], true, true) ?? doStandardCalcs(dataFrame.fields[1], true, true);
      return value[sortBy] ?? 0;
    };

    const seriesCalcs = series.map((dataFrame) => ({
      value: reducer(dataFrame),
      dataFrame: dataFrame,
    }));

    seriesCalcs.sort((a, b) => {
      if (a.value !== undefined && b.value !== undefined) {
        return b.value - a.value;
      }
      return 0;
    });

    if (direction === 'asc') {
      seriesCalcs.reverse();
    }

    return seriesCalcs.map(({ dataFrame }) => dataFrame);
  },
  (series: DataFrame[], sortBy: string, direction = 'asc') => {
    const firstTimestamp = series.length > 0 ? series[0].fields[0].values[0] : 0;
    const lastTimestamp =
      series.length > 0
        ? series[series.length - 1].fields[0].values[series[series.length - 1].fields[0].values.length - 1]
        : 0;
    const firstValue = series.length > 0 ? getLabelValueFromDataFrame(series[0]) : '';
    const lastValue = series.length > 0 ? getLabelValueFromDataFrame(series[series.length - 1]) : '';
    const key = `${firstValue}_${lastValue}_${firstTimestamp}_${lastTimestamp}_${series.length}_${sortBy}_${direction}`;
    return key;
  }
);

const initOutlierDetector = (series: DataFrame[]) => {
  if (!wasmSupported()) {
    return;
  }

  // Combine all frames into one by joining on time.
  const joined = outerJoinDataFrames({ frames: series });
  if (!joined) {
    return;
  }

  // Get number fields: these are our series.
  const joinedSeries = joined.fields.filter((f) => f.type === FieldType.number);
  const points = joinedSeries.map((series) => new Float64Array(series.values));

  try {
    const detector = OutlierDetector.dbscan({ sensitivity: 0.4 }).preprocess(points);
    outliers = detector.detect();
  } catch (e) {
    console.error(e);
    outliers = undefined;
  }
};

let outliers: OutlierOutput | undefined = undefined;

export const calculateOutlierValue = (series: DataFrame[], data: DataFrame): number => {
  if (!wasmSupported()) {
    throw new Error('WASM not supported, fall back to stdDev');
  }
  if (!outliers) {
    throw new Error('Initialize outlier detector first');
  }

  const index = series.indexOf(data);
  if (outliers.seriesResults[index].isOutlier) {
    return -outliers.seriesResults[index].outlierIntervals.length;
  }

  return 0;
};

export const sortSeriesByName = (series: DataFrame[], direction: string) => {
  const sortedSeries = [...series];
  sortedSeries.sort((a, b) => {
    const valueA = getLabelValueFromDataFrame(a);
    const valueB = getLabelValueFromDataFrame(b);
    if (!valueA || !valueB) {
      return 0;
    }
    return valueA?.localeCompare(valueB) ?? 0;
  });
  if (direction === 'desc') {
    sortedSeries.reverse();
  }
  return sortedSeries;
};

export const wasmSupported = () => {
  const support = typeof WebAssembly === 'object';

  if (!support) {
    reportExploreMetrics('wasm_not_supported', {});
  }

  return support;
};
