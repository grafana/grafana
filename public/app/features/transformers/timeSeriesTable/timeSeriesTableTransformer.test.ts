import { toDataFrame, FieldType, Labels } from '@grafana/data';

import { timeSeriesToTableTransform } from './timeSeriesTableTransformer';

describe('timeSeriesTableTransformer', () => {
  it('Will transform', () => {
    const series = [
      getTimeSeries({ instance: 'A', pod: 'B' }),
      getTimeSeries({ instance: 'A', pod: 'C' }),
      getTimeSeries({ instance: 'A', pod: 'D' }),
    ];

    const result = timeSeriesToTableTransform({}, series)[0];
    expect(result.fields.length).toBe(3);
    expect(result.fields[0].values.toArray()).toEqual(['A', 'A', 'A']);
    expect(result.fields[1].values.toArray()).toEqual(['B', 'C', 'D']);
  });
});

function getTimeSeries(labels: Labels) {
  return toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [10] },
      {
        name: 'Value',
        type: FieldType.number,
        values: [10],
        labels,
      },
    ],
  });
}
