import { DataFrameDTO, FieldType } from '../types/dataFrame';

import { MutableDataFrame } from './MutableDataFrame';

describe('Reversing DataFrame', () => {
  describe('when called with a DataFrame', () => {
    it('then it should reverse the order of values in all fields', () => {
      const frame: DataFrameDTO = {
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
      };

      const helper = new MutableDataFrame(frame);

      expect(helper.fields[0].values).toEqual([100, 200, 300]);
      expect(helper.fields[1].values).toEqual(['a', 'b', 'c']);
      expect(helper.fields[2].values).toEqual([1, 2, 3]);

      helper.reverse();

      expect(helper.fields[0].values).toEqual([300, 200, 100]);
      expect(helper.fields[1].values).toEqual(['c', 'b', 'a']);
      expect(helper.fields[2].values).toEqual([3, 2, 1]);
    });
  });
});

describe('Apending DataFrame', () => {
  it('Should append values', () => {
    const dto: DataFrameDTO = {
      fields: [
        { name: 'time', type: FieldType.time, values: [100] },
        { name: 'name', type: FieldType.string, values: ['a', 'b'] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    };

    const frame = new MutableDataFrame(dto);
    expect(frame.fields[0].values).toEqual([100, undefined, undefined]);

    // Set a value on the second row
    frame.set(1, { time: 200, name: 'BB', value: 20 });
    expect(frame.toArray()).toEqual([
      { time: 100, name: 'a', value: 1 }, // 1
      { time: 200, name: 'BB', value: 20 }, // 2
      { time: undefined, name: undefined, value: 3 }, // 3
    ]);

    // Add a time value that has an array type
    frame.add({ time: 300 });
    expect(frame.toArray()).toEqual([
      { time: 100, name: 'a', value: 1 }, // 1
      { time: 200, name: 'BB', value: 20 }, // 2
      { time: undefined, name: undefined, value: 3 }, // 3
      { time: 300, name: undefined, value: undefined }, // 5
    ]);

    // Make sure length survives a spread operator
    const keys = Object.keys(frame);
    const copy = { ...frame } as MutableDataFrame;
    expect(keys).toContain('length');
    expect(copy.length).toEqual(frame.length);
  });
});
