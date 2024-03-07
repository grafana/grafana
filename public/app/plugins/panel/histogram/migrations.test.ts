import { FieldConfigSource, PanelModel } from '@grafana/data';

import { changeToHistogramPanelMigrationHandler } from './migrations';

describe('Histogram migrations', () => {
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
          mode: 'histogram',
        },
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToHistogramPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel.options.combine).toBe(true);
  });
});
