import { toDataFrame, FieldType } from '@grafana/data';
import { getLabelInfo } from './FieldLabelPicker';

describe('get labels info', () => {
  it('simple worldmap', () => {
    const seriesA = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'value', labels: { state: 'CA' }, type: FieldType.number, values: [3, 4, 5, 6] },
        { name: 'value', labels: { state: 'NY' }, type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    const seriesB = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'value', labels: { state: 'CA', country: 'USA' }, type: FieldType.number, values: [3, 4, 5, 6] },
        { name: 'value', labels: { country: 'USA' }, type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    const info = getLabelInfo([seriesA, seriesB], 'zip');
    expect(info.options).toMatchInlineSnapshot(`
      Array [
        Object {
          "description": "CA, NY",
          "label": "state",
          "value": "state",
        },
        Object {
          "description": "USA",
          "label": "country",
          "value": "country",
        },
        Object {
          "label": "zip (not found)",
          "value": "zip",
        },
      ]
    `);
  });
});
