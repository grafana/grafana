import { toDataFrame } from '../../dataframe/processDataFrame';

import { concatenateFields, ConcatenateFrameNameMode } from './concat';

export const simpleABC = toDataFrame({
  name: 'ABC',
  fields: [
    { name: 'A', values: [1, 2] },
    { name: 'B', values: [1, 2] },
    { name: 'C', values: [1, 2] },
  ],
});

export const simpleXYZ = toDataFrame({
  name: 'XYZ',
  fields: [
    { name: 'X', values: [1, 2, 3] },
    { name: 'Y', values: [1, 2, 3] },
    { name: 'Z', values: [1, 2, 3] },
  ],
});

describe('Concat Transformer', () => {
  it('dropping frame name', () => {
    const frame = concatenateFields([simpleABC, simpleXYZ], { frameNameMode: ConcatenateFrameNameMode.Drop });
    expect(frame.length).toBe(3);
    expect(frame.fields.map((f) => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      [
        {
          "labels": undefined,
          "name": "A",
        },
        {
          "labels": undefined,
          "name": "B",
        },
        {
          "labels": undefined,
          "name": "C",
        },
        {
          "labels": undefined,
          "name": "X",
        },
        {
          "labels": undefined,
          "name": "Y",
        },
        {
          "labels": undefined,
          "name": "Z",
        },
      ]
    `);
  });

  it('using field name', () => {
    const frame = concatenateFields([simpleABC, simpleXYZ], { frameNameMode: ConcatenateFrameNameMode.FieldName });
    expect(frame.length).toBe(3);
    expect(frame.fields.map((f) => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      [
        {
          "labels": undefined,
          "name": "ABC · A",
        },
        {
          "labels": undefined,
          "name": "ABC · B",
        },
        {
          "labels": undefined,
          "name": "ABC · C",
        },
        {
          "labels": undefined,
          "name": "XYZ · X",
        },
        {
          "labels": undefined,
          "name": "XYZ · Y",
        },
        {
          "labels": undefined,
          "name": "XYZ · Z",
        },
      ]
    `);
  });

  it('using field label', () => {
    const frame = concatenateFields([simpleABC, simpleXYZ], {
      frameNameMode: ConcatenateFrameNameMode.Label,
      frameNameLabel: 'sensor',
    });
    expect(frame.length).toBe(3);
    expect(frame.fields.map((f) => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      [
        {
          "labels": {
            "sensor": "ABC",
          },
          "name": "A",
        },
        {
          "labels": {
            "sensor": "ABC",
          },
          "name": "B",
        },
        {
          "labels": {
            "sensor": "ABC",
          },
          "name": "C",
        },
        {
          "labels": {
            "sensor": "XYZ",
          },
          "name": "X",
        },
        {
          "labels": {
            "sensor": "XYZ",
          },
          "name": "Y",
        },
        {
          "labels": {
            "sensor": "XYZ",
          },
          "name": "Z",
        },
      ]
    `);
  });
});
