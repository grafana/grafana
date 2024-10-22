import { createDataFrame, FieldType } from '@grafana/data';

import { HeatmapData } from '../fields';

import { formatMilliseconds, getFieldFromData, getHoverCellColor, getSparseCellMinMax } from './utils';

describe('formatMilliseconds', () => {
  it('converts ms to appropriate unit', async () => {
    let msToFormat = 10;
    let formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('10 ms');

    msToFormat = 1000;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 s');

    msToFormat = 1000 * 120;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('2 m');

    msToFormat = 1000 * 60 * 60;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 h');

    msToFormat = 1000 * 60 * 60 * 24;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 day');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 3;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('3 weeks');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 4;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('4 weeks');

    msToFormat = 1000 * 60 * 60 * 24 * 7 * 5;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 month');

    msToFormat = 1000 * 60 * 60 * 24 * 365;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('1 year');

    msToFormat = 1000 * 60 * 60 * 24 * 365 * 2;
    formatted = formatMilliseconds(msToFormat);
    expect(formatted).toBe('2 years');
  });
});

describe('getHoverCellColor', () => {
  it('returns the correct cell color and color palette when colorIndex is not null', () => {
    const heatmapData: HeatmapData = {
      heatmapColors: {
        minValue: 0,
        maxValue: 2,
        palette: ['#FF0000', '#00FF00', '#0000FF'],
        values: [0, 1, 2],
      },
    };

    const result = getHoverCellColor(heatmapData, 1);

    expect(result.cellColor).toBe('#00FF00');
    expect(result.colorPalette).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });

  it('handles an index that is out of bounds', () => {
    const heatmapData: HeatmapData = {
      heatmapColors: {
        minValue: 0,
        maxValue: 1,
        palette: ['#FF0000', '#00FF00'],
        values: [0, 1],
      },
    };

    const result = getHoverCellColor(heatmapData, 2);

    expect(result.cellColor).toBeUndefined();
    expect(result.colorPalette).toEqual(['#FF0000', '#00FF00']);
  });
});

describe('getFieldFromData', () => {
  const dataFrame = createDataFrame({
    fields: [
      { name: 'xMax', values: [1, 2, 3] },
      { name: 'yMax', values: [4, 5, 6] },
      { name: 'value', values: [7, 8, 9] },
    ],
  });

  it('returns the right field when sparse is false', () => {
    const result = getFieldFromData(dataFrame, 'x', false);
    expect(result).toEqual(dataFrame.fields[0]);

    const result2 = getFieldFromData(dataFrame, 'y', false);
    expect(result2).toEqual(dataFrame.fields[1]);

    const result3 = getFieldFromData(dataFrame, 'count', false);
    expect(result3).toEqual(dataFrame.fields[2]);
  });

  it('returns the right field when sparse is true', () => {
    const result = getFieldFromData(dataFrame, 'x', true);
    expect(result?.name).toEqual('xMax');

    const result2 = getFieldFromData(dataFrame, 'y', true);
    expect(result2?.name).toEqual('yMax');

    const result3 = getFieldFromData(dataFrame, 'count', true);
    expect(result3?.name).toBeUndefined();
  });
});

describe('getSparseCellMinMax', () => {
  it('returns the right bucket values for sparse data', () => {
    const heatmapData: HeatmapData = {
      heatmap: {
        fields: [
          {
            name: 'xMax',
            type: FieldType.time,
            config: { interval: 1000 },
            values: [1654000708000, 1654000709000, 1654000710000],
          },
          { name: 'yMin', type: FieldType.number, config: {}, values: [4, 5, 6] },
          { name: 'yMax', type: FieldType.number, config: {}, values: [7, 8, 9] },
          { name: 'count', type: FieldType.number, config: {}, values: [10, 11, 12] },
        ],
        length: 4,
      },
    };

    const result = getSparseCellMinMax(heatmapData, 0);
    expect(result).toEqual({ xBucketMin: 1654000707000, xBucketMax: 1654000708000, yBucketMin: 4, yBucketMax: 7 });

    const result2 = getSparseCellMinMax(heatmapData, 2);
    expect(result2).toEqual({ xBucketMin: 1654000709000, xBucketMax: 1654000710000, yBucketMin: 6, yBucketMax: 9 });
  });
});
