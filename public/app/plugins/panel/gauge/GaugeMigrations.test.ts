import { PanelModel } from '@grafana/data';

import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';

describe('Gauge Panel Migrations', () => {
  it('from 6.1.1', () => {
    const panel = {
      datasource: '-- Grafana --',
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 0,
      },
      id: 2,
      options: {
        maxValue: '50',
        minValue: '-50',
        orientation: 'auto',
        showThresholdLabels: true,
        showThresholdMarkers: true,
        thresholds: [
          {
            color: 'green',
            index: 0,
            value: -Infinity,
          },
          {
            color: '#EAB839',
            index: 1,
            value: -25,
          },
          {
            color: '#6ED0E0',
            index: 2,
            value: 0,
          },
          {
            color: 'red',
            index: 3,
            value: 25,
          },
        ],
        valueMappings: [
          {
            id: 1,
            operator: '',
            value: '',
            text: 'BIG',
            type: 2,
            from: '50',
            to: '1000',
          },
        ],
        valueOptions: {
          decimals: 3,
          prefix: 'XX',
          stat: 'last',
          suffix: 'YY',
          unit: 'accMS2',
        },
      },
      pluginVersion: '6.1.6',
      targets: [
        {
          refId: 'A',
        },
        {
          refId: 'B',
        },
        {
          refId: 'C',
        },
      ],
      timeFrom: null,
      timeShift: null,
      title: 'Panel Title',
      type: 'gauge',
    } as Omit<PanelModel, 'fieldConfig'>;

    const result = gaugePanelMigrationHandler(panel as PanelModel);
    expect(result).toMatchSnapshot();

    // Ignored due to the API change
    //@ts-ignore
    expect(result.reduceOptions.defaults).toBeUndefined();
    // Ignored due to the API change
    //@ts-ignore
    expect(result.reduceOptions.overrides).toBeUndefined();

    expect((panel as PanelModel).fieldConfig).toMatchInlineSnapshot(`
      Object {
        "defaults": Object {
          "color": Object {
            "mode": "thresholds",
          },
          "decimals": 3,
          "mappings": Array [
            Object {
              "from": "50",
              "id": 1,
              "operator": "",
              "text": "BIG",
              "to": "1000",
              "type": 2,
              "value": "",
            },
          ],
          "max": "50",
          "min": "-50",
          "thresholds": Object {
            "mode": "absolute",
            "steps": Array [
              Object {
                "color": "green",
                "index": 0,
                "value": -Infinity,
              },
              Object {
                "color": "#EAB839",
                "index": 1,
                "value": -25,
              },
              Object {
                "color": "#6ED0E0",
                "index": 2,
                "value": 0,
              },
              Object {
                "color": "red",
                "index": 3,
                "value": 25,
              },
            ],
          },
          "unit": "accMS2",
        },
        "overrides": Array [],
      }
    `);
  });

  it('change from angular singlestat to gauge', () => {
    const old: any = {
      angular: {
        format: 'ms',
        decimals: 7,
        gauge: {
          maxValue: 150,
          minValue: -10,
          show: true,
          thresholdLabels: true,
          thresholdMarkers: true,
        },
      },
    };

    const panel = {} as PanelModel;
    const newOptions = gaugePanelChangedHandler(panel, 'singlestat', old);
    expect(panel.fieldConfig.defaults.unit).toBe('ms');
    expect(panel.fieldConfig.defaults.min).toBe(-10);
    expect(panel.fieldConfig.defaults.max).toBe(150);
    expect(panel.fieldConfig.defaults.decimals).toBe(7);
    expect(newOptions.showThresholdMarkers).toBe(true);
    expect(newOptions.showThresholdLabels).toBe(true);
  });
});
