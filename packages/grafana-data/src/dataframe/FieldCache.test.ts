import { FieldCache } from './FieldCache';
import { FieldType } from '../types/dataFrame';
import { toDataFrame } from './processDataFrame';

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

  describe('field retrieval', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [4, 5, 6] },
      ],
    });
    const ext = new FieldCache(frame);

    it('should get the first field with a duplicate name', () => {
      const field = ext.getFieldByName('value');
      expect(field!.name).toEqual('value');
      expect(field!.values.toArray()).toEqual([1, 2, 3]);
    });

    it('should return index of the field', () => {
      const field = ext.getFirstFieldOfType(FieldType.number);
      expect(field!.index).toEqual(2);
    });
  });
});
