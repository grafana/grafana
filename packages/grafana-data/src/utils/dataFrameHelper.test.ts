import { FieldType, DataFrame, Field } from '../types/index';
import { DataFrameHelper, createField } from './dataFrameHelper';
import { DateTime } from './moment_wrapper';

interface MySpecialObject {
  time: DateTime;
  name: string;
  value: number;
  more: string; // MISSING
}

describe('dataFrameHelper', () => {
  const frame: DataFrame = {
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
    ],
  };
  const ext = new DataFrameHelper(frame);

  it('Should get a valid count for the fields', () => {
    expect(ext.length).toEqual(3);
  });

  it('Should get a typed vector', () => {
    const vector = ext.getValues<MySpecialObject>();
    expect(vector.length).toEqual(3);

    const first = vector[0];
    expect(first.time).toEqual(frame.fields[0].values[0]);
    expect(first.name).toEqual(frame.fields[1].values[0]);
    expect(first.value).toEqual(frame.fields[2].values[0]);
    expect(first.more).toBeUndefined();
  });
});

describe('FieldCache', () => {
  it('when creating a new FieldCache from fields should be able to query cache', () => {
    const fields: Field[] = [
      createField('time', FieldType.time),
      createField('string', FieldType.string),
      createField('number', FieldType.number),
      createField('boolean', FieldType.boolean),
      createField('other', FieldType.other),
      createField('undefined'),
    ];
    const fieldCache = new DataFrameHelper({ fields });
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

    expect(fieldCache.fields[0]).toMatchObject(expectedFields[0]);
    expect(fieldCache.fields[1]).toMatchObject(expectedFields[1]);
    expect(fieldCache.fields[2]).toMatchObject(expectedFields[2]);
    expect(fieldCache.fields[3]).toMatchObject(expectedFields[3]);
    expect(fieldCache.fields[4]).toMatchObject(expectedFields[4]);
    expect(fieldCache.fields[5]).toMatchObject(expectedFields[5]);
    expect(fieldCache.fields[6]).toBeUndefined();

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
    expect(fieldCache.getFieldByName('null')).toBeUndefined();
  });
});
