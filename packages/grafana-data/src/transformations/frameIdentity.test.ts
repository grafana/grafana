import { toDataFrame } from '../dataframe/processDataFrame';
import { FieldType } from '../types/dataFrame';

import { getRowIdentity } from './frameIdentity';

it('identifies parent rows by their values without including nested frames', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'Parent', type: FieldType.string, values: ['one', 'two'] },
      { name: 'Children', type: FieldType.nestedFrames, values: [[], []] },
    ],
  });
  expect(getRowIdentity(frame, 0)).toBe('["one"]');
  expect(getRowIdentity(frame, 1)).toBe('["two"]');
  frame.fields[1].values[0] = [toDataFrame({ fields: [{ name: 'Value', values: [10] }] })];
  expect(getRowIdentity(frame, 0)).toBe('["one"]');
  frame.fields[0].values[0] = 'new';
  expect(getRowIdentity(frame, 0)).toBe('["new"]');
});
