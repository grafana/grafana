import { utils } from 'xlsx';

import { DataFrame } from '@grafana/data';

import { workSheetToFrame } from './sheet';

describe('sheets', () => {
  it('will use first row as names', () => {
    const sheet = utils.aoa_to_sheet([
      ['Number', 'String', 'Bool', 'Date', 'Object'],
      [1, 'A', true, Date.UTC(2020, 1, 1), { hello: 'world' }],
      [2, 'B', false, Date.UTC(2020, 1, 2), { hello: 'world' }],
    ]);
    const frame = workSheetToFrame(sheet);

    expect(toSnapshotFrame(frame)).toMatchInlineSnapshot(`
      [
        {
          "name": "Number",
          "type": "number",
          "values": [
            1,
            2,
          ],
        },
        {
          "name": "String",
          "type": "string",
          "values": [
            "A",
            "B",
          ],
        },
        {
          "name": "Bool",
          "type": "boolean",
          "values": [
            true,
            false,
          ],
        },
        {
          "name": "Date",
          "type": "number",
          "values": [
            1580515200000,
            1580601600000,
          ],
        },
        {
          "name": "Object",
          "type": "string",
          "values": [
            undefined,
            undefined,
          ],
        },
      ]
    `);
  });

  it('will use calculated data when cells are typed', () => {
    const sheet = utils.aoa_to_sheet([
      [1, 'A', true, Date.UTC(2020, 1, 1), { hello: 'world' }],
      [2, 'B', false, Date.UTC(2020, 1, 2), { hello: 'world' }],
      [3, 'C', true, Date.UTC(2020, 1, 3), { hello: 'world' }],
    ]);
    const frame = workSheetToFrame(sheet);

    expect(toSnapshotFrame(frame)).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "type": "number",
          "values": [
            1,
            2,
            3,
          ],
        },
        {
          "name": "B",
          "type": "string",
          "values": [
            "A",
            "B",
            "C",
          ],
        },
        {
          "name": "C",
          "type": "boolean",
          "values": [
            true,
            false,
            true,
          ],
        },
        {
          "name": "D",
          "type": "number",
          "values": [
            1580515200000,
            1580601600000,
            1580688000000,
          ],
        },
        {
          "name": "E",
          "type": "string",
          "values": [
            undefined,
            undefined,
            undefined,
          ],
        },
      ]
    `);
  });

  it('is OK with nulls and undefineds, and misalignment', () => {
    const sheet = utils.aoa_to_sheet([
      [null, 'A', true],
      [2, 'B', null, Date.UTC(2020, 1, 2), { hello: 'world' }],
      [3, 'C', true, undefined, { hello: 'world' }],
    ]);
    const frame = workSheetToFrame(sheet);

    expect(toSnapshotFrame(frame)).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "type": "number",
          "values": [
            undefined,
            2,
            3,
          ],
        },
        {
          "name": "B",
          "type": "string",
          "values": [
            "A",
            "B",
            "C",
          ],
        },
        {
          "name": "C",
          "type": "boolean",
          "values": [
            true,
            undefined,
            true,
          ],
        },
        {
          "name": "D",
          "type": "number",
          "values": [
            undefined,
            1580601600000,
            undefined,
          ],
        },
        {
          "name": "E",
          "type": "string",
          "values": [
            undefined,
            undefined,
            undefined,
          ],
        },
      ]
    `);
  });
});

function toSnapshotFrame(frame: DataFrame) {
  return frame.fields.map((f) => ({ name: f.name, values: f.values, type: f.type }));
}
