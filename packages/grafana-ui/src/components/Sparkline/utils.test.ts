import { FieldSparkline, FieldType } from '@grafana/data';

import { preparePlotFrame } from './utils';

describe('Prepare Sparkline plot frame', () => {
  it('should return sorted array if x-axis numeric', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [5, 4, 3, 2, 1],
        type: FieldType.number,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1, 2, 3, 4, 5]);
    expect(frame.fields[1].values).toEqual([5, 4, 3, 2, 1]);
  });

  it('should return a dataframe with unmodified fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000]);
    expect(frame.fields[1].values).toEqual([1, 2, 3, 4, 5]);
  });

  it('should return a dataframe with sorted fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1682258400000, 1681653600000, 1681048800000, 1680444000000, 1679839200000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000]);
    expect(frame.fields[1].values).toEqual([5, 4, 3, 2, 1]);
  });

  it('should return a dataframe with null thresholds applied to sorted fields', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [7, 2, 4],
        type: FieldType.time,
        config: { interval: 1 },
      },
      y: {
        name: 'y',
        values: [1, 2, 3],
        type: FieldType.number,
        config: {},
      },
    };

    const frame = preparePlotFrame(sparkline);

    expect(frame.fields[0].values).toEqual([2, 3, 4, 5, 6, 7]);
    expect(frame.fields[1].values).toEqual([2, null, 3, null, null, 1]);
  });
});
