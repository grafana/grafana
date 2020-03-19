import {
  ArrayVector,
  DataTransformerConfig,
  DataTransformerID,
  FieldType,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import { JoinOptions } from '@grafana/data/src/transformations/transformers/join';

const series1 = toDataFrame({
  name: 'series1',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 250, 2000, 500] },
    { name: 'temperature', type: FieldType.number, values: [12.12, 2.5, 14.44, 10.1] },
  ],
});

const series3 = toDataFrame({
  name: 'series3',
  fields: [
    { name: 'time', type: FieldType.time, values: [500, 750, 1000, 3000] },
    { name: 'temperature', type: FieldType.number, values: [11.11, 7.5, 13.13, 18.18] },
  ],
});

describe('Join Transformer', () => {
  it('joins by field', () => {
    const cfg: DataTransformerConfig<JoinOptions> = {
      id: DataTransformerID.join,
      options: {
        byField: 'time',
      },
    };

    const filtered = transformDataFrame([cfg], [series1, series3])[0];
    expect(filtered.fields).toEqual([
      {
        name: 'time',
        type: FieldType.time,
        values: new ArrayVector([250, 500, 750, 1000, 2000, 3000]),
        config: {},
        labels: undefined,
      },
      {
        name: 'series1',
        type: FieldType.number,
        values: new ArrayVector([2.5, 10.1, null, 12.12, 14.44, null]),
        config: {},
        labels: undefined,
      },
      {
        name: 'series3',
        type: FieldType.number,
        values: new ArrayVector([null, 11.11, 7.5, 13.13, null, 18.18]),
        config: {},
        labels: undefined,
      },
    ]);
  });
});
