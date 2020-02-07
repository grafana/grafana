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

      expect(helper.values.time.toArray()).toEqual([100, 200, 300]);
      expect(helper.values.name.toArray()).toEqual(['a', 'b', 'c']);
      expect(helper.values.value.toArray()).toEqual([1, 2, 3]);

      helper.reverse();

      expect(helper.values.time.toArray()).toEqual([300, 200, 100]);
      expect(helper.values.name.toArray()).toEqual(['c', 'b', 'a']);
      expect(helper.values.value.toArray()).toEqual([3, 2, 1]);
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
    expect(frame.values.time.toArray()).toEqual([100, null, null]);

    // Set a value on the second row
    frame.set(1, { time: 200, name: 'BB', value: 20 });
    expect(frame.toArray()).toEqual([
      { time: 100, name: 'a', value: 1 }, // 1
      { time: 200, name: 'BB', value: 20 }, // 2
      { time: null, name: null, value: 3 }, // 3
    ]);

    // Set a value on the second row
    frame.add({ value2: 'XXX' }, true);
    expect(frame.toArray()).toEqual([
      { time: 100, name: 'a', value: 1, value2: null }, // 1
      { time: 200, name: 'BB', value: 20, value2: null }, // 2
      { time: null, name: null, value: 3, value2: null }, // 3
      { time: null, name: null, value: null, value2: 'XXX' }, // 4
    ]);

    // Add a time value that has an array type
    frame.add({ time: 300 });
    expect(frame.toArray()).toEqual([
      { time: 100, name: 'a', value: 1, value2: null }, // 1
      { time: 200, name: 'BB', value: 20, value2: null }, // 2
      { time: null, name: null, value: 3, value2: null }, // 3
      { time: null, name: null, value: null, value2: 'XXX' }, // 4
      { time: 300, name: null, value: null, value2: null }, // 5
    ]);

    // Make sure length survives a spread operator
    const keys = Object.keys(frame);
    const copy = { ...frame } as any;
    expect(keys).toContain('length');
    expect(copy.length).toEqual(frame.length);
  });
});
