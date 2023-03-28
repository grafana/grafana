import { DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { getSeriesName, formatLabels, getSeriesValue, isEmptySeries } from './util';

const EMPTY_FRAME: DataFrame = toDataFrame([]);
const NAMED_FRAME: DataFrame = {
  name: 'MyFrame',
  ...toDataFrame([]),
};

const DATA_FRAME: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
});

const DATA_FRAME_LARGE_DECIMAL: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1.23456789] }],
});

const DATA_FRAME_WITH_LABELS: DataFrame = toDataFrame({
  fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3], labels: { foo: 'bar' } }],
});

describe('formatLabels', () => {
  it('should work with no labels', () => {
    expect(formatLabels({})).toBe('');
  });

  it('should work with 1 label', () => {
    expect(formatLabels({ foo: 'bar' })).toBe('foo=bar');
  });

  it('should work with multiple labels', () => {
    expect(formatLabels({ foo: 'bar', baz: 'qux' })).toBe('foo=bar, baz=qux');
  });
});

describe('isEmptySeries', () => {
  it('should be true for empty series', () => {
    expect(isEmptySeries([EMPTY_FRAME])).toBe(true);
    expect(isEmptySeries([EMPTY_FRAME, EMPTY_FRAME])).toBe(true);

    expect(isEmptySeries([DATA_FRAME])).toBe(false);
    expect(isEmptySeries([EMPTY_FRAME, DATA_FRAME])).toBe(false);
  });
});

describe('getSeriesName', () => {
  it('should work with named data frame', () => {
    const name = getSeriesName(NAMED_FRAME);
    expect(name).toBe('MyFrame');
  });

  it('should work with empty data frame', () => {
    expect(getSeriesName(EMPTY_FRAME)).toBe('');
  });

  it('should work with labeled frame', () => {
    const name = getSeriesName(DATA_FRAME_WITH_LABELS);
    expect(name).toBe('foo=bar');
  });

  it('should work with NoData frames', () => {
    expect(getSeriesName(EMPTY_FRAME)).toBe('');
  });
});

describe('getSeriesValue', () => {
  it('should work with empty data frame', () => {
    expect(getSeriesValue(EMPTY_FRAME)).toBe(undefined);
  });

  it('should work with data frame', () => {
    const name = getSeriesValue(DATA_FRAME);
    expect(name).toBe(1);
  });

  it('should round values', () => {
    expect(getSeriesValue(DATA_FRAME_LARGE_DECIMAL)).toBe(1.23457);
  });
});
