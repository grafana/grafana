import { FieldType } from '../types/index';
import { FieldCache } from './fieldCache';

describe('FieldCache', () => {
  it('when creating a new FieldCache from fields should be able to query cache', () => {
    const fields = [
      { name: 'time', type: FieldType.time },
      { name: 'string', type: FieldType.string },
      { name: 'number', type: FieldType.number },
      { name: 'boolean', type: FieldType.boolean },
      { name: 'other', type: FieldType.other },
      { name: 'undefined' },
    ];
    const fieldCache = new FieldCache(fields);
    const allFields = fieldCache.getFields();
    expect(allFields).toHaveLength(6);

    const expectedFields = [
      { ...fields[0], index: 0 },
      { ...fields[1], index: 1 },
      { ...fields[2], index: 2 },
      { ...fields[3], index: 3 },
      { ...fields[4], index: 4 },
      { ...fields[5], type: FieldType.other, index: 5 },
    ];

    expect(allFields).toMatchObject(expectedFields);

    expect(fieldCache.hasFieldOfType(FieldType.time)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.string)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.number)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.boolean)).toBeTruthy();
    expect(fieldCache.hasFieldOfType(FieldType.other)).toBeTruthy();

    expect(fieldCache.getFields(FieldType.time)).toMatchObject([expectedFields[0]]);
    expect(fieldCache.getFields(FieldType.string)).toMatchObject([expectedFields[1]]);
    expect(fieldCache.getFields(FieldType.number)).toMatchObject([expectedFields[2]]);
    expect(fieldCache.getFields(FieldType.boolean)).toMatchObject([expectedFields[3]]);
    expect(fieldCache.getFields(FieldType.other)).toMatchObject([expectedFields[4], expectedFields[5]]);

    expect(fieldCache.getFieldByIndex(0)).toMatchObject(expectedFields[0]);
    expect(fieldCache.getFieldByIndex(1)).toMatchObject(expectedFields[1]);
    expect(fieldCache.getFieldByIndex(2)).toMatchObject(expectedFields[2]);
    expect(fieldCache.getFieldByIndex(3)).toMatchObject(expectedFields[3]);
    expect(fieldCache.getFieldByIndex(4)).toMatchObject(expectedFields[4]);
    expect(fieldCache.getFieldByIndex(5)).toMatchObject(expectedFields[5]);
    expect(fieldCache.getFieldByIndex(6)).toBeNull();

    expect(fieldCache.getFirstFieldOfType(FieldType.time)).toMatchObject(expectedFields[0]);
    expect(fieldCache.getFirstFieldOfType(FieldType.string)).toMatchObject(expectedFields[1]);
    expect(fieldCache.getFirstFieldOfType(FieldType.number)).toMatchObject(expectedFields[2]);
    expect(fieldCache.getFirstFieldOfType(FieldType.boolean)).toMatchObject(expectedFields[3]);
    expect(fieldCache.getFirstFieldOfType(FieldType.other)).toMatchObject(expectedFields[4]);

    expect(fieldCache.hasFieldNamed('tim')).toBeFalsy();
    expect(fieldCache.hasFieldNamed('time')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('string')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('number')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('boolean')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('other')).toBeTruthy();
    expect(fieldCache.hasFieldNamed('undefined')).toBeTruthy();

    expect(fieldCache.getFieldByName('time')).toMatchObject(expectedFields[0]);
    expect(fieldCache.getFieldByName('string')).toMatchObject(expectedFields[1]);
    expect(fieldCache.getFieldByName('number')).toMatchObject(expectedFields[2]);
    expect(fieldCache.getFieldByName('boolean')).toMatchObject(expectedFields[3]);
    expect(fieldCache.getFieldByName('other')).toMatchObject(expectedFields[4]);
    expect(fieldCache.getFieldByName('undefined')).toMatchObject(expectedFields[5]);
    expect(fieldCache.getFieldByName('null')).toBeNull();
  });
});
