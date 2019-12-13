import { FieldType } from '../../types/dataFrame';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldMatcherID } from '../matchers/ids';
import { transformDataFrame } from '../transformers';

export const allSeries = [
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'server', type: FieldType.number, values: ['Server A', 'Server B'] },
      { name: 'value A', type: FieldType.number, values: [1, 2] },
    ],
  }),
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000] },
      { name: 'server', type: FieldType.number, values: ['Server A', 'Server C'] },
      { name: 'value B', type: FieldType.number, values: [1, 2] },
    ],
  }),
];

describe('Join Transformer', () => {
  it('simple', () => {
    const cfg = {
      id: DataTransformerID.join,
      options: {},
    };

    const joined = transformDataFrame([cfg], allSeries)[0];
    expect(joined.fields.length).toBe(4);
    expect(joined.fields[0].name).toBe('time');
    expect(joined.fields[1].name).toBe('server');
    expect(joined.fields[2].name).toBe('value A');
    expect(joined.fields[3].name).toBe('value B');
  });
});
