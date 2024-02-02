import { DataFrame, Field } from '@grafana/data';

import { HeatmapData } from '../fields';

type BucketsMinMax = {
  xBucketMin: number;
  xBucketMax: number;
  yBucketMin: string;
  yBucketMax: string;
};

export const getHoverCellColor = (data: HeatmapData, index: number) => {
  const colorPalette = data.heatmapColors?.palette!;
  const colorIndex = data.heatmapColors?.values[index];

  let cellColor: string | undefined = undefined;

  if (colorIndex != null) {
    cellColor = colorPalette[colorIndex];
  }

  return { cellColor, colorPalette };
};

const conversions: Record<string, number> = {
  year: 1000 * 60 * 60 * 24 * 365,
  month: 1000 * 60 * 60 * 24 * 30,
  week: 1000 * 60 * 60 * 24 * 7,
  day: 1000 * 60 * 60 * 24,
  h: 1000 * 60 * 60,
  m: 1000 * 60,
  s: 1000,
  ms: 1,
};

const noPluralize = new Set(['ms', 's', 'm', 'h']);

// @TODO: display "~ 1 year/month"?
export const formatMilliseconds = (milliseconds: number) => {
  let value = 1;
  let unit = 'ms';

  for (unit in conversions) {
    if (milliseconds >= conversions[unit]) {
      value = Math.floor(milliseconds / conversions[unit]);
      break;
    }
  }

  const plural = value !== 1 && !noPluralize.has(unit);
  const unitString = plural ? unit + 's' : unit;

  return `${value} ${unitString}`;
};

export const getFieldFromData = (data: DataFrame, fieldType: string, isSparse: boolean) => {
  let field: Field | undefined;

  switch (fieldType) {
    case 'x':
      field = isSparse
        ? data?.fields.find(({ name }) => name === 'x' || name === 'xMin' || name === 'xMax')
        : data?.fields[0];
      break;
    case 'y':
      field = isSparse
        ? data?.fields.find(({ name }) => name === 'y' || name === 'yMin' || name === 'yMax')
        : data?.fields[1];
      break;
    case 'count':
      field = isSparse ? data?.fields.find(({ name }) => name === 'count') : data?.fields[2];
      break;
  }

  return field;
};

export const getSparseCellMinMax = (data: HeatmapData, index: number): BucketsMinMax => {
  let fields = data.heatmap!.fields;

  let xMax = fields.find((f) => f.name === 'xMax')!;
  let yMin = fields.find((f) => f.name === 'yMin')!;
  let yMax = fields.find((f) => f.name === 'yMax')!;

  let interval = xMax.config.interval!;

  return {
    xBucketMin: xMax.values[index] - interval,
    xBucketMax: xMax.values[index],
    yBucketMin: yMin.values[index],
    yBucketMax: yMax.values[index],
  };
};
