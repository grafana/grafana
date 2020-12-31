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
    expect(frame.fields.map(f => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      Array [
        Object {
          "labels": undefined,
          "name": "A",
        },
        Object {
          "labels": undefined,
          "name": "B",
        },
        Object {
          "labels": undefined,
          "name": "C",
        },
        Object {
          "labels": undefined,
          "name": "X",
        },
        Object {
          "labels": undefined,
          "name": "Y",
        },
        Object {
          "labels": undefined,
          "name": "Z",
        },
      ]
    `);
  });

  it('using field name', () => {
    const frame = concatenateFields([simpleABC, simpleXYZ], { frameNameMode: ConcatenateFrameNameMode.FieldName });
    expect(frame.length).toBe(3);
    expect(frame.fields.map(f => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      Array [
        Object {
          "labels": undefined,
          "name": "ABC · A",
        },
        Object {
          "labels": undefined,
          "name": "ABC · B",
        },
        Object {
          "labels": undefined,
          "name": "ABC · C",
        },
        Object {
          "labels": undefined,
          "name": "XYZ · X",
        },
        Object {
          "labels": undefined,
          "name": "XYZ · Y",
        },
        Object {
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
    expect(frame.fields.map(f => ({ name: f.name, labels: f.labels }))).toMatchInlineSnapshot(`
      Array [
        Object {
          "labels": Object {
            "sensor": "ABC",
          },
          "name": "A",
        },
        Object {
          "labels": Object {
            "sensor": "ABC",
          },
          "name": "B",
        },
        Object {
          "labels": Object {
            "sensor": "ABC",
          },
          "name": "C",
        },
        Object {
          "labels": Object {
            "sensor": "XYZ",
          },
          "name": "X",
        },
        Object {
          "labels": Object {
            "sensor": "XYZ",
          },
          "name": "Y",
        },
        Object {
          "labels": Object {
            "sensor": "XYZ",
          },
          "name": "Z",
        },
      ]
    `);
  });
});
