import { DataFrame, Labels, roundDecimals } from '@grafana/data';

const getSeriesName = (frame: DataFrame): string => {
  return frame.name ?? formatLabels(frame.fields[0].labels ?? {});
};

const getSeriesValue = (frame: DataFrame) => {
  const value = frame.fields[0].values.get(0);

  if (Number.isFinite(value)) {
    return roundDecimals(value, 5);
  }

  return value;
};

const formatLabels = (labels: Labels): string => {
  return Object.entries(labels)
    .map(([key, value]) => key + '=' + value)
    .join(', ');
};

const isEmptySeries = (series: DataFrame[]): boolean => {
  const isEmpty = series.every((serie) =>
    serie.fields.every((field) => field.values.toArray().every((value) => value == null))
  );

  return isEmpty;
};

export { getSeriesName, getSeriesValue, formatLabels, isEmptySeries };
