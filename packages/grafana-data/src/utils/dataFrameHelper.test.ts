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
