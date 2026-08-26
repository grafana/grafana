import { type FieldDTO, FieldType } from '../types/dataFrame';

import { createDataFrame, toDataFrame } from './processDataFrame';
import { anySeriesWithTimeField, addRow } from './utils';

describe('anySeriesWithTimeField', () => {
  const TIME_FIELD: FieldDTO<number> = { name: 'time', type: FieldType.time, values: [100, 200, 300] };
  const STRING_FIELD: FieldDTO<string> = { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] };
  const NUMBER_FIELD: FieldDTO<number> = { name: 'value', type: FieldType.number, values: [1, 2, 3] };
  // A field can be *named* time while being typed as something else; only the type counts.
  const TIME_NAMED_NUMBER_FIELD: FieldDTO<number> = { name: 'time', type: FieldType.number, values: [1, 2, 3] };

  const frameOf = (...fields: Array<FieldDTO<string | number>>) => toDataFrame({ fields });
  const withTime = () => frameOf(TIME_FIELD, STRING_FIELD, NUMBER_FIELD);
  const withoutTime = () => frameOf(STRING_FIELD, NUMBER_FIELD);

  it.each([
    { desc: 'an empty list of frames', frames: [], expected: false },
    { desc: 'a single frame with no time field', frames: [withoutTime()], expected: false },
    { desc: 'a single frame with a time field', frames: [withTime()], expected: true },
    { desc: 'several frames, none with a time field', frames: [withoutTime(), withoutTime()], expected: false },
    {
      desc: 'the time field in the first of several frames',
      frames: [withTime(), withoutTime(), withoutTime()],
      expected: true,
    },
    {
      // The loop must keep scanning past frames that have no time field, so put the only time
      // field last - a check that inspected just the first frame would still pass otherwise.
      desc: 'the time field only in the last of several frames',
      frames: [withoutTime(), withoutTime(), withTime()],
      expected: true,
    },
    {
      desc: 'a frame whose only time-named field is typed as a number',
      frames: [frameOf(TIME_NAMED_NUMBER_FIELD, STRING_FIELD)],
      expected: false,
    },
  ])('returns $expected for $desc', ({ frames, expected }) => {
    expect(anySeriesWithTimeField(frames)).toBe(expected);
  });
});

describe('addRow', () => {
  const frame = createDataFrame({
    fields: [
      { name: 'name', type: FieldType.string },
      { name: 'date', type: FieldType.time },
      { name: 'number', type: FieldType.number },
    ],
  });
  const date = Date.now();

  it('adds row to data frame as object', () => {
    addRow(frame, { name: 'A', date, number: 1 });
    expect(frame.fields[0].values[0]).toBe('A');
    expect(frame.fields[1].values[0]).toBe(date);
    expect(frame.fields[2].values[0]).toBe(1);
    expect(frame.length).toBe(1);
  });

  it('adds row to data frame as array', () => {
    addRow(frame, ['B', date, 42]);
    expect(frame.fields[0].values[1]).toBe('B');
    expect(frame.fields[1].values[1]).toBe(date);
    expect(frame.fields[2].values[1]).toBe(42);
    expect(frame.length).toBe(2);
  });
});
