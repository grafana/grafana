import { DataFrameDTO, FieldType } from '../types';
import { FieldCache, MutableDataFrame } from './dataFrameHelper';
import { toDataFrame } from './processDataFrame';

describe('dataFrameHelper', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      { name: 'value', type: FieldType.number, values: [4, 5, 6] },
    ],
  });
  const ext = new FieldCache(frame);

  it('Should get the first field with a duplicate name', () => {
    const field = ext.getFieldByName('value');
    expect(field!.name).toEqual('value');
    expect(field!.values.toJSON()).toEqual([1, 2, 3]);
  });
});

describe('FieldCache', () => {
  it('when creating a new FieldCache from fields should be able to query cache', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'string', type: FieldType.string },
        { name: 'number', type: FieldType.number },
        { name: 'boolean', type: FieldType.boolean },
        { name: 'other', type: FieldType.other },
        { name: 'undefined' },
      ],
    });
    const fieldCache = new FieldCache(frame);
    const allFields = fieldCache.getFields();
    expect(allFields).toHaveLength(6);

    const expectedFieldNames = ['time', 'string', 'number', 'boolean', 'other', 'undefined'];

    expect(allFields.map(f => f.name)).toEqual(expectedFieldNames);

    expect(fieldCache.hasFieldOfType(FieldType.time)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.string)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.number)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.boolean)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.other)).toBeTruthy();

    expect(fieldCache.getFields(FieldType.time).map(f => f.name)).toEqual([expectedFieldNames[0]]);
    expect(fieldCache.getFields(FieldType.string).map(f => f.name)).toEqual([expectedFieldNames[1]]);
    expect(fieldCache.getFields(FieldType.number).map(f => f.name)).toEqual([expectedFieldNames[2]]);
    expect(fieldCache.getFields(FieldType.boolean).map(f => f.name)).toEqual([expectedFieldNames[3]]);
    expect(fieldCache.getFields(FieldType.other).map(f => f.name)).toEqual([
      expectedFieldNames[4],
      expectedFieldNames[5],
    ]);

    expect(fieldCache.fields[0].name).toEqual(expectedFieldNames[0]);
    expect(fieldCache.fields[1].name).toEqual(expectedFieldNames[1]);
    expect(fieldCache.fields[2].name).toEqual(expectedFieldNames[2]);
    expect(fieldCache.fields[3].name).toEqual(expectedFieldNames[3]);
    expect(fieldCache.fields[4].name).toEqual(expectedFieldNames[4]);
    expect(fieldCache.fields[5].name).toEqual(expectedFieldNames[5]);
    expect(fieldCache.fields[6]).toBeUndefined();

    expect(fieldCache.getFirstFieldOfType(FieldType.time)!.name).toEqual(expectedFieldNames[0]);
    expect(fieldCache.getFirstFieldOfType(FieldType.string)!.name).toEqual(expectedFieldNames[1]);
    expect(fieldCache.getFirstFieldOfType(FieldType.number)!.name).toEqual(expectedFieldNames[2]);
    expect(fieldCache.getFirstFieldOfType(FieldType.boolean)!.name).toEqual(expectedFieldNames[3]);
    expect(fieldCache.getFirstFieldOfType(FieldType.other)!.name).toEqual(expectedFieldNames[4]);

    expect(fieldCache.hasFieldNamed('tim')).toBeFalsy();
    expect(fieldCache.hasFieldNamed('time')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('string')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('number')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('boolean')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('other')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('undefined')).toBeTruthy();

    expect(fieldCache.getFieldByName('time')!.name).toEqual(expectedFieldNames[0]);
    expect(fieldCache.getFieldByName('string')!.name).toEqual(expectedFieldNames[1]);
    expect(fieldCache.getFieldByName('number')!.name).toEqual(expectedFieldNames[2]);
    expect(fieldCache.getFieldByName('boolean')!.name).toEqual(expectedFieldNames[3]);
    expect(fieldCache.getFieldByName('other')!.name).toEqual(expectedFieldNames[4]);
    expect(fieldCache.getFieldByName('undefined')!.name).toEqual(expectedFieldNames[5]);
    expect(fieldCache.getFieldByName('null')).toBeUndefined();
  });
});

describe('reverse', () => {
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

    // Make sure length survives a spread operator
    const keys = Object.keys(frame);
    const copy = { ...frame } as any;
    expect(keys).toContain('length');
    expect(copy.length).toEqual(frame.length);
  });
});
