import { DateTime } from '../datetime/moment_wrapper';
import { FieldType, DataFrameDTO } from '../types/dataFrame';

import { DataFrameView } from './DataFrameView';
import { MutableDataFrame } from './MutableDataFrame';

interface MySpecialObject {
  time: DateTime;
  name: string;
  value: number;
  more: string; // MISSING
}

describe('dataFrameView', () => {
  const frame: DataFrameDTO = {
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
    ],
  };
  const ext = new MutableDataFrame(frame);
  const vector = new DataFrameView<MySpecialObject>(ext);

  it('Should get a typed vector', () => {
    expect(vector.length).toEqual(3);

    const first = vector.get(0);
    expect(first.time).toEqual(100);
    expect(first.name).toEqual('a');
    expect(first.value).toEqual(1);
    expect(first.more).toBeUndefined();
  });

  it('Should support the spread operator', () => {
    expect(vector.length).toEqual(3);

    const first = vector.get(0);
    const copy = { ...first };
    expect(copy.time).toEqual(100);
    expect(copy.name).toEqual('a');
    expect(copy.value).toEqual(1);
    expect(copy.more).toBeUndefined();
  });

  it('Should support array indexes', () => {
    expect(vector.length).toEqual(3);

    const first = vector.get(0) as any;
    expect(first[0]).toEqual(100);
    expect(first[1]).toEqual('a');
    expect(first[2]).toEqual(1);
    expect(first[3]).toBeUndefined();
  });

  it('Should advertise the property names for each field', () => {
    expect(vector.length).toEqual(3);
    const first = vector.get(0);
    const keys = Object.keys(first);
    expect(keys).toEqual(['time', 'name', 'value']);
  });

  it('has a weird side effect that the object values change after interaction', () => {
    expect(vector.length).toEqual(3);

    // Get the first value
    const first = vector.get(0);
    expect(first.name).toEqual('a');

    // Then get the second one
    const second = vector.get(1);

    // the values for 'first' have changed
    expect(first.name).toEqual('b');
    expect(first.name).toEqual(second.name);
  });

  it('toJSON returns plain object', () => {
    expect(vector.toJSON()[0]).toEqual({
      time: 100,
      name: 'a',
      value: 1,
    });
  });

  it('Can handle fields with number name', () => {
    const view = new DataFrameView<MySpecialObject>(
      new MutableDataFrame({
        fields: [
          { name: '1', type: FieldType.string, values: ['a'] },
          { name: '2', type: FieldType.string, values: ['b'] },
        ],
      })
    );

    const obj = view.get(0) as any;
    expect(obj['1']).toEqual('a');
    expect(obj['2']).toEqual('b');
  });
});
