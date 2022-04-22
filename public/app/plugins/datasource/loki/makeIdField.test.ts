import { ArrayVector, DataFrame, FieldType } from '@grafana/data';

import { makeIdField } from './makeIdField';

function makeFrame(timestamps: number[], values: string[], timestampNss: string[], refId?: string): DataFrame {
  return {
    name: 'frame',
    refId,
    meta: {
      executedQueryString: 'something1',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: new ArrayVector(timestamps),
      },
      {
        name: 'Value',
        type: FieldType.string,
        config: {},
        labels: {
          foo: 'bar',
        },
        values: new ArrayVector(values),
      },
      {
        name: 'tsNs',
        type: FieldType.time,
        config: {},
        values: new ArrayVector(timestampNss),
      },
    ],
    length: timestamps.length,
  };
}

describe('loki makeIdField', () => {
  it('should always generate unique ids for logs', () => {
    const frame = makeFrame(
      [1579857562021, 1579857562021, 1579857562021, 1579857562021],
      [
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Non-Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
      ],
      ['1579857562021616000', '1579857562021616000', '1579857562021616000', '1579857562021616000']
    );
    expect(makeIdField(frame)).toEqual({
      config: {},
      name: 'id',
      type: 'string',
      values: new ArrayVector([
        '75fceace-9f98-5134-b222-643fdcde2877',
        '75fceace-9f98-5134-b222-643fdcde2877_1',
        '4a081a89-040d-5f64-9477-a4d846ce9f6b',
        '75fceace-9f98-5134-b222-643fdcde2877_2',
      ]),
    });
  });

  it('should append refId to the unique ids if refId is provided', () => {
    const frame = makeFrame(
      [1579857562021, 1579857562021, 1579857562021, 1579857562021],
      [
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Non-Duplicated"',
        't=2020-02-12T15:04:51+0000 lvl=info msg="Duplicated"',
      ],
      ['1579857562021616000', '1579857562021616000', '1579857562021616000', '1579857562021616000'],
      'X'
    );
    expect(makeIdField(frame)).toEqual({
      config: {},
      name: 'id',
      type: 'string',
      values: new ArrayVector([
        '75fceace-9f98-5134-b222-643fdcde2877_X',
        '75fceace-9f98-5134-b222-643fdcde2877_1_X',
        '4a081a89-040d-5f64-9477-a4d846ce9f6b_X',
        '75fceace-9f98-5134-b222-643fdcde2877_2_X',
      ]),
    });
  });
});
