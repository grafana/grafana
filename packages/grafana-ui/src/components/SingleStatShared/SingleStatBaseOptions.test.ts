import { PanelModel } from '@grafana/data';

import { sharedSingleStatMigrationHandler, sharedSingleStatPanelChangedHandler } from './SingleStatBaseOptions';

describe('sharedSingleStatMigrationHandler', () => {
  it('from old valueOptions model without pluginVersion', () => {
    const panel = {
      options: {
        valueOptions: {
          unit: 'watt',
          stat: 'last',
          decimals: 5,
        },
        minValue: 10,
        maxValue: 100,
        valueMappings: [{ type: 1, value: '1', text: 'OK' }],
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
      },
      title: 'Usage',
      type: 'bargauge',
    };

    sharedSingleStatMigrationHandler(panel as any);
    expect((panel as any).fieldConfig).toMatchInlineSnapshot(`
      {
        "defaults": {
          "color": {
            "mode": "thresholds",
          },
          "decimals": 5,
          "mappings": [
            {
              "text": "OK",
              "type": 1,
              "value": "1",
            },
          ],
          "max": 100,
          "min": 10,
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
  });

  it('move thresholds to scale', () => {
    const panel = {
      options: {
        fieldOptions: {
          defaults: {
            thresholds: [
              {
                color: 'green',
                index: 0,
                value: null,
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
          },
        },
      },
    };

    sharedSingleStatMigrationHandler(panel as any);

    expect((panel as any).fieldConfig).toMatchInlineSnapshot(`
      {
        "defaults": {
          "mappings": undefined,
          "thresholds": undefined,
        },
        "overrides": [],
      }
    `);
  });

  it('Remove unused `overrides` option', () => {
    const panel = {
      options: {
        fieldOptions: {
          unit: 'watt',
          stat: 'last',
          decimals: 5,
          defaults: {
            min: 0,
            max: 100,
            mappings: [],
          },
          override: {
            min: 0,
            max: 100,
            mappings: [],
          },
        },
      },
      title: 'Usage',
      type: 'bargauge',
    };

    sharedSingleStatMigrationHandler(panel as any);
    expect((panel as any).fieldConfig).toMatchInlineSnapshot(`
      {
        "defaults": {
          "mappings": undefined,
          "max": 100,
          "min": 0,
          "thresholds": undefined,
        },
        "overrides": [],
      }
    `);
  });

  it('Rename title to displayName', () => {
    const panel = {
      options: {
        fieldOptions: {
          stat: 'last',
          decimals: 5,
          defaults: {
            title: 'newTitle',
            min: 0,
            max: 100,
            mappings: [],
          },
          override: {},
        },
      },
      title: 'Usage',
      type: 'bargauge',
    };

    sharedSingleStatMigrationHandler(panel as any);
    expect((panel as any).fieldConfig.defaults.displayName).toBe('newTitle');
  });

  it('change from angular singlestat with no enabled gauge', () => {
    const old = {
      angular: {
        format: 'ms',
        decimals: 7,
        gauge: {
          maxValue: 150,
          minValue: -10,
          show: false,
        },
      },
    };
    const panel = {} as PanelModel;
    sharedSingleStatPanelChangedHandler(panel, 'singlestat', old);
    expect(panel.fieldConfig.defaults.unit).toBe('ms');
    expect(panel.fieldConfig.defaults.min).toBe(undefined);
    expect(panel.fieldConfig.defaults.max).toBe(undefined);
  });

  it('change from angular singlestat with tableColumn set', () => {
    const old = {
      angular: {
        tableColumn: 'info',
      },
    };
    const panel = {} as PanelModel;
    const newOptions = sharedSingleStatPanelChangedHandler(panel, 'singlestat', old);
    expect(newOptions.reduceOptions.calcs).toEqual(['mean']);
    expect(newOptions.reduceOptions.fields).toBe('/^info$/');
  });

  it('change from angular singlestat with no enabled gauge', () => {
    const old = {
      angular: {
        format: 'ms',
        decimals: 7,
        gauge: {
          maxValue: 150,
          minValue: -10,
          show: false,
        },
      },
    };

    const panel = {} as PanelModel;
    sharedSingleStatPanelChangedHandler(panel, 'singlestat', old);
    expect(panel.fieldConfig.defaults.unit).toBe('ms');
    expect(panel.fieldConfig.defaults.min).toBe(undefined);
    expect(panel.fieldConfig.defaults.max).toBe(undefined);
  });

  it('auto set min/max for percent units before 8.0', () => {
    const panel = {
      options: {
        fieldOptions: {
          defaults: {
            unit: 'percentunit',
          },
        },
      },
      title: 'Usage',
      type: 'bargauge',
    } as unknown as PanelModel;
    sharedSingleStatMigrationHandler(panel as any);
    expect(panel.fieldConfig.defaults.unit).toBe('percentunit');
    expect(panel.fieldConfig.defaults.min).toBe(0);
    expect(panel.fieldConfig.defaults.max).toBe(1);
  });
});
