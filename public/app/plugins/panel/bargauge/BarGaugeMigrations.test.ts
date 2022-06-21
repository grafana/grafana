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
    expect((panel as any).fieldConfig).toMatchInlineSnapshot(`
      Object {
        "defaults": Object {
          "color": Object {
            "mode": "thresholds",
          },
          "decimals": null,
          "mappings": Array [],
          "max": 33,
          "min": -22,
          "thresholds": Object {
            "mode": "absolute",
            "steps": Array [
              Object {
                "color": "green",
                "index": 0,
                "value": -Infinity,
              },
              Object {
                "color": "orange",
                "index": 1,
                "value": 40,
              },
              Object {
                "color": "red",
                "index": 2,
                "value": 80,
              },
            ],
          },
          "unit": "watt",
        },
        "overrides": Array [],
      }
    `);

    // should options options
    expect(newOptions).toMatchInlineSnapshot(`
      Object {
        "displayMode": "lcd",
        "orientation": "vertical",
        "reduceOptions": Object {
          "calcs": Array [
            "mean",
          ],
          "limit": undefined,
          "values": false,
        },
      }
    `);
  });
});
