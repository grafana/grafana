import { FieldType } from '@grafana/data';
import { toDataFrame } from '@grafana/data/src/dataframe/processDataFrame';
import { HeatmapCalculationOptions } from '@grafana/schema';

import { rowsToCellsHeatmap, calculateHeatmapFromData } from './heatmap';

describe('Heatmap transformer', () => {
  it('calculate heatmap from input data', async () => {
    const options: HeatmapCalculationOptions = {
      //
    };

    const data = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
        { name: 'temp', type: FieldType.number, config: { unit: 'm2' }, values: [1.1, 2.2, 3.3, 4.4] },
      ],
    });

    const heatmap = calculateHeatmapFromData([data], options);
    expect(heatmap.fields.map((f) => ({ name: f.name, type: f.type, config: f.config }))).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "xMin",
          "type": "time",
        },
        {
          "config": {
            "custom": {
              "scaleDistribution": {
                "type": "linear",
              },
            },
            "unit": "m2",
          },
          "name": "yMin",
          "type": "number",
        },
        {
          "config": {
            "unit": "short",
          },
          "name": "Count",
          "type": "number",
        },
      ]
    `);
  });

  it('convert heatmap buckets to scanlines', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'A', type: FieldType.number, config: { unit: 'm2' }, values: [1.1, 1.2, 1.3] },
        { name: 'B', type: FieldType.number, config: { unit: 'm2' }, values: [2.1, 2.2, 2.3] },
        { name: 'C', type: FieldType.number, config: { unit: 'm2' }, values: [3.1, 3.2, 3.3] },
      ],
    });

    const heatmap = rowsToCellsHeatmap({ frame, value: 'Speed' });
    expect(heatmap.fields.map((f) => ({ name: f.name, type: f.type, config: f.config }))).toMatchInlineSnapshot(`
      [
        {
          "config": {},
          "name": "xMax",
          "type": "time",
        },
        {
          "config": {
            "unit": "short",
          },
          "name": "y",
          "type": "number",
        },
        {
          "config": {
            "unit": "m2",
          },
          "name": "Speed",
          "type": "number",
        },
      ]
    `);
    expect(heatmap.meta).toMatchInlineSnapshot(`
      {
        "custom": {
          "yMatchWithLabel": undefined,
          "yOrdinalDisplay": [
            "A",
            "B",
            "C",
          ],
        },
        "type": "heatmap-cells",
      }
    `);
    expect(heatmap.fields[1].values).toMatchInlineSnapshot(`
      [
        0,
        1,
        2,
        0,
        1,
        2,
        0,
        1,
        2,
      ]
    `);
  });
});
