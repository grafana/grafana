import { FieldConfigSource, PanelModel } from '@grafana/data';

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
          values: 'avg',
        },
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToBarChartPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);

    const transform = panel.transformations![0];
    expect(transform.id).toBe('reduce');
    expect(transform.options.reducers).toBe('avg');
  });
});
