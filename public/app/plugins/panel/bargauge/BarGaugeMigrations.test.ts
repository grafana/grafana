import { PanelModel } from '@grafana/data';

import { barGaugePanelMigrationHandler } from './BarGaugeMigrations';

describe('BarGauge Panel Migrations', () => {
  it('from 6.2', () => {
    const panel = {
      id: 7,
      links: [],
      options: {
        displayMode: 'lcd',
        fieldOptions: {
          calcs: ['mean'],
          defaults: {
            decimals: null,
            max: -22,
            min: 33,
            unit: 'watt',
          },
          mappings: [],
          override: {},
          thresholds: [
            {
              color: 'green',
              index: 0,
              value: -Infinity,
            },
            {
              color: 'orange',
              index: 1,
              value: 40,
            },
            {
              color: 'red',
              index: 2,
              value: 80,
            },
          ],
          values: false,
        },
        orientation: 'vertical',
      },
      pluginVersion: '6.2.0',
      targets: [],
      title: 'Usage',
      type: 'bargauge',
    } as Omit<PanelModel, 'fieldConfig'>;

    const newOptions = barGaugePanelMigrationHandler(panel as PanelModel);

    // should mutate panel model and move field config out of panel.options
    expect((panel as PanelModel).fieldConfig).toMatchInlineSnapshot(`
      {
        "defaults": {
          "color": {
            "mode": "thresholds",
          },
          "decimals": null,
          "mappings": [],
          "max": 33,
          "min": -22,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "index": 0,
                "value": -Infinity,
              },
              {
                "color": "orange",
                "index": 1,
                "value": 40,
              },
              {
                "color": "red",
                "index": 2,
                "value": 80,
              },
            ],
          },
          "unit": "watt",
        },
        "overrides": [],
      }
    `);

    // should options options
    expect(newOptions).toMatchInlineSnapshot(`
      {
        "displayMode": "lcd",
        "orientation": "vertical",
        "reduceOptions": {
          "calcs": [
            "mean",
          ],
          "limit": undefined,
          "values": false,
        },
      }
    `);
  });
});
