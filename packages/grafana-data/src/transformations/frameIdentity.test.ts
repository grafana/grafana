import { toDataFrame } from '../dataframe/processDataFrame';
import { FieldType } from '../types/dataFrame';

import { getFrameIdentity, getRowIdentity } from './frameIdentity';

it('distinguishes duplicate frames by occurrence while ignoring refreshed values', () => {
  const first = toDataFrame({ refId: 'A', fields: [{ name: 'Value', type: FieldType.number, values: [1] }] });
  const second = toDataFrame({ refId: 'A', fields: [{ name: 'Value', type: FieldType.number, values: [2] }] });
  const frames = [first, second];
  expect(getFrameIdentity(frames, 0)).toBe('["A",null,[["Value","number",null]]]:0');
  expect(getFrameIdentity(frames, 1)).toBe('["A",null,[["Value","number",null]]]:1');
  second.fields[0].values[0] = 3;
  expect(getFrameIdentity(frames, 1)).toBe('["A",null,[["Value","number",null]]]:1');
  expect(getFrameIdentity(frames, 2)).toBe('');
});

it('includes field labels in frame identity', () => {
  const frame = toDataFrame({
    refId: 'A',
    fields: [{ name: 'Value', type: FieldType.number, labels: { region: 'west' }, values: [1] }],
  });
  expect(getFrameIdentity([frame], 0)).toBe('["A",null,[["Value","number",{"region":"west"}]]]:0');
});

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
