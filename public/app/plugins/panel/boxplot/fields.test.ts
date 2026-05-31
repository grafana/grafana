import { createDataFrame, createTheme, FieldType } from '@grafana/data';

import { prepBoxplotData } from './fields';

const theme = createTheme();

describe('prepBoxplotData', () => {
  it('auto-detects Reduce-transformation columns as a five-number summary', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Field', type: FieldType.string, values: ['A', 'B'] },
        { name: 'Min', type: FieldType.number, values: [1, 2] },
        { name: '25th %', type: FieldType.number, values: [3, 4] },
        { name: 'Median', type: FieldType.number, values: [5, 6] },
        { name: '75th %', type: FieldType.number, values: [7, 8] },
        { name: 'Max', type: FieldType.number, values: [9, 10] },
      ],
    });

    const data = prepBoxplotData([frame], {}, theme);

    expect(data.warn).toBeUndefined();
    expect(data.categories).toEqual(['A', 'B']);
    expect(data.rows).toHaveLength(2);

    const [a, b] = data.rows;
    expect(a).toMatchObject({ category: 'A', q1: 3, median: 5, q3: 7, whiskerLo: 1, whiskerHi: 9 });
    // five-number summary: whiskers reach min/max, so there are no outliers
    expect(a.outlierLo).toBeUndefined();
    expect(a.outlierHi).toBeUndefined();
    expect(b).toMatchObject({ q1: 4, median: 6, q3: 8, whiskerLo: 2, whiskerHi: 10 });

    expect(data.yMin).toBe(1);
    expect(data.yMax).toBe(10);
  });

  it('draws min/max as outliers when whisker fields are mapped (seven-number summary)', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Field', type: FieldType.string, values: ['A'] },
        { name: 'min', type: FieldType.number, values: [0] },
        { name: 'q1', type: FieldType.number, values: [3] },
        { name: 'median', type: FieldType.number, values: [5] },
        { name: 'q3', type: FieldType.number, values: [7] },
        { name: 'max', type: FieldType.number, values: [20] },
        { name: 'lowerWhisker', type: FieldType.number, values: [2] },
        { name: 'upperWhisker', type: FieldType.number, values: [10] },
      ],
    });

    const data = prepBoxplotData([frame], {}, theme);

    expect(data.rows).toHaveLength(1);
    const row = data.rows[0];
    expect(row.whiskerLo).toBe(2);
    expect(row.whiskerHi).toBe(10);
    expect(row.outlierLo).toBe(0);
    expect(row.outlierHi).toBe(20);
    expect(row.values).toEqual({
      min: 0,
      q1: 3,
      median: 5,
      q3: 7,
      max: 20,
      lowerWhisker: 2,
      upperWhisker: 10,
    });
    // y extent includes the outliers
    expect(data.yMin).toBe(0);
    expect(data.yMax).toBe(20);
  });

  it('does not flag an outlier when min/max sit within the mapped whiskers', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'min', type: FieldType.number, values: [3] },
        { name: 'q1', type: FieldType.number, values: [3] },
        { name: 'median', type: FieldType.number, values: [5] },
        { name: 'q3', type: FieldType.number, values: [7] },
        { name: 'max', type: FieldType.number, values: [7] },
        { name: 'lowerWhisker', type: FieldType.number, values: [1] },
        { name: 'upperWhisker', type: FieldType.number, values: [9] },
      ],
    });

    const row = prepBoxplotData([frame], {}, theme).rows[0];
    expect(row.whiskerLo).toBe(1);
    expect(row.whiskerHi).toBe(9);
    expect(row.outlierLo).toBeUndefined();
    expect(row.outlierHi).toBeUndefined();
  });

  it('honors an explicit field mapping over auto-detection', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'lo', type: FieldType.number, values: [2] },
        { name: 'mid', type: FieldType.number, values: [5] },
        { name: 'hi', type: FieldType.number, values: [8] },
      ],
    });

    const data = prepBoxplotData([frame], { q1: 'lo', median: 'mid', q3: 'hi' }, theme);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ q1: 2, median: 5, q3: 8 });
  });

  it('warns when Q1/median/Q3 cannot be resolved', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'Min', type: FieldType.number, values: [1] },
        { name: 'Max', type: FieldType.number, values: [9] },
      ],
    });

    const data = prepBoxplotData([frame], {}, theme);
    expect(data.rows).toHaveLength(0);
    expect(data.warn).toBeTruthy();
  });

  it('skips rows with null box values and falls back to row-index categories', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'q1', type: FieldType.number, values: [3, null] },
        { name: 'median', type: FieldType.number, values: [5, null] },
        { name: 'q3', type: FieldType.number, values: [7, 8] },
      ],
    });

    const data = prepBoxplotData([frame], {}, theme);
    // second row dropped (null median); no string/time field, so category is the 1-based row index
    expect(data.rows).toHaveLength(1);
    expect(data.categories).toEqual(['1']);
  });

  it('returns an empty result for no series', () => {
    expect(prepBoxplotData([], {}, theme).rows).toHaveLength(0);
    expect(prepBoxplotData(undefined, {}, theme).rows).toHaveLength(0);
  });

  it('does not throw when the field map is undefined (freshly added panel)', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'q1', type: FieldType.number, values: [3] },
        { name: 'median', type: FieldType.number, values: [5] },
        { name: 'q3', type: FieldType.number, values: [7] },
      ],
    });
    expect(() => prepBoxplotData([frame], undefined, theme)).not.toThrow();
    expect(prepBoxplotData([frame], undefined, theme).rows).toHaveLength(1);
  });
});
