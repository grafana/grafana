import { FieldType } from '../types/dataFrame';
import { DataFrameDTO, dataFrameFromDTO, toDataFrameDTO } from './DataFrameDTO';

describe('dataFrameDTO', () => {
  it('converts nan and inf', () => {
    const dto: DataFrameDTO = {
      name: 'hello',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'name', type: FieldType.string, values: ['a', 'b', null], replaced: { NaN: [2] } },
        { name: 'value', type: FieldType.number, values: [1, 2, null], replaced: { Inf: [2] } },
      ],
    };
    const frame = dataFrameFromDTO(dto);
    expect(toDataFrameDTO(frame)).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "time",
            "type": "time",
            "values": Array [
              100,
              200,
              300,
            ],
          },
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "name",
            "type": "string",
            "values": Array [
              "a",
              "b",
              NaN,
            ],
          },
          Object {
            "config": Object {},
            "labels": undefined,
            "name": "value",
            "type": "number",
            "values": Array [
              1,
              2,
              Infinity,
            ],
          },
        ],
        "meta": undefined,
        "name": undefined,
        "refId": undefined,
      }
    `);
  });

  it('makes everything the same length', () => {
    const dto: DataFrameDTO = {
      name: 'hello',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'name', type: FieldType.string, values: ['a', 'b'] },
        { name: 'value', type: FieldType.number, values: [1] },
      ],
    };
    const frame = dataFrameFromDTO(dto);
    expect(frame.fields[0].values.length).toEqual(3);
    expect(frame.fields[1].values.length).toEqual(3);
    expect(frame.fields[2].values.length).toEqual(3);
  });
});
