import { FieldType } from '../types/dataFrame';
import { DataFrameDTO, dataFrameFromDTO, DataFrameReplacementValue, toDataFrameDTO } from './DataFrameDTO';

describe('dataFrameView', () => {
  const dto: DataFrameDTO = {
    name: 'hello',
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', null] },
      { name: 'value', type: FieldType.number, values: [1, 2, null] },
    ],
    replace: [
      { field: 1, value: DataFrameReplacementValue.Undefined, index: [2] },
      { field: 2, value: DataFrameReplacementValue.NaN, index: [2] },
    ],
  };
  const frame = dataFrameFromDTO(dto);

  it('back to DTO', () => {
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
              undefined,
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
              NaN,
            ],
          },
        ],
        "meta": undefined,
        "name": undefined,
        "refId": undefined,
      }
    `);
  });
});
