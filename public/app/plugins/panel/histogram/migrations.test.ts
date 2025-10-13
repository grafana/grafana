import { FieldConfigSource, PanelModel } from '@grafana/data';
import { StackingMode } from '@grafana/ui';

import { changeToHistogramPanelMigrationHandler } from './migrations';

describe('Histogram migrations', () => {
  let prevFieldConfig: FieldConfigSource;

  beforeEach(() => {
    prevFieldConfig = {
      defaults: {},
      overrides: [],
    };
  });

  it('Should migrate from old graph', () => {
    const old = {
      angular: {
        xaxis: {
          mode: 'histogram',
        },
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToHistogramPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel.options.combine).toBe(false);
  });

  it('Should migrate from old graph with percent stacking', () => {
    const old = {
      angular: {
        xaxis: {
          mode: 'histogram',
        },
        stack: true,
        percentage: true,
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToHistogramPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel.fieldConfig.defaults.custom.stacking.mode).toBe(StackingMode.Percent);
    expect(panel.options.combine).toBe(false);
  });

  it('Should migrate from old graph with normal stacking', () => {
    const old = {
      angular: {
        xaxis: {
          mode: 'histogram',
        },
        stack: true,
      },
    };

    const panel = {} as PanelModel;
    panel.options = changeToHistogramPanelMigrationHandler(panel, 'graph', old, prevFieldConfig);
    expect(panel.fieldConfig.defaults.custom.stacking.mode).toBe(StackingMode.Normal);
    expect(panel.options.combine).toBe(false);
  });
});
