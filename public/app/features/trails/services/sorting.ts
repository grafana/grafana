import { memoize } from 'lodash';

import { DataFrame, doStandardCalcs, fieldReducers } from '@grafana/data';

import { getLabelValueFromDataFrame } from './levels';

export const sortSeries = memoize(
  (series: DataFrame[], sortBy: string) => {
    if (sortBy === 'alphabetical') {
      return sortSeriesByName(series, 'asc');
    }

    if (sortBy === 'alphabetical-reversed') {
      return sortSeriesByName(series, 'desc');
    }

    const reducer = (dataFrame: DataFrame) => {
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

    return seriesCalcs.map(({ dataFrame }) => dataFrame);
  },
  (series: DataFrame[], sortBy: string) => {
    const firstTimestamp = series.length > 0 ? series[0].fields[0].values[0] : 0;
    const lastTimestamp =
      series.length > 0
        ? series[series.length - 1].fields[0].values[series[series.length - 1].fields[0].values.length - 1]
        : 0;
    const firstValue = series.length > 0 ? getLabelValueFromDataFrame(series[0]) : '';
    const lastValue = series.length > 0 ? getLabelValueFromDataFrame(series[series.length - 1]) : '';
    const key = `${firstValue}_${lastValue}_${firstTimestamp}_${lastTimestamp}_${series.length}_${sortBy}`;
    return key;
  }
);

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
