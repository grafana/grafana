import { FieldConfigSource, FieldMatcherID, PanelModel } from '@grafana/data';

import { changeToBarChartPanelMigrationHandler } from './migrations';

describe('Bar chart Migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('From old graph', () => {
    const old = {
      angular: {
        xaxis: {
          mode: 'series',
          values: ['avg'],
        },
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToBarChartPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);
    const transformations = panel.transformations || [];
    expect(transformations).toHaveLength(2);

    const reduceTransform = transformations[0];
    expect(reduceTransform.id).toBe('reduce');
    expect(reduceTransform.options.reducers).toHaveLength(1);
    expect(reduceTransform.options.reducers[0]).toBe('mean');

    const transposeTransform = transformations[1];
    expect(transposeTransform.id).toBe('transpose');

    expect(panel.fieldConfig.overrides).toHaveLength(1);
    expect(panel.fieldConfig.overrides[0].matcher.id).toBe(FieldMatcherID.byName);
    expect(panel.fieldConfig.overrides).toMatchInlineSnapshot(`
        [
          {
            "matcher": {
              "id": "byName",
              "options": "Field",
            },
            "properties": [
              {
                "id": "custom.axisPlacement",
                "value": "hidden",
              },
            ],
          },
        ]
    `);
  });
});
