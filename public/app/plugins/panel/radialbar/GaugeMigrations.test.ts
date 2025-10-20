import { PanelModel } from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema/dist/esm/index.gen';

import { gaugePanelMigrationHandler, gaugePanelChangedHandler } from './GaugeMigrations';

describe('Gauge Panel Migrations', () => {
  it('from old gauge', () => {
    const panel = {
      id: 2,
      options: {
        reduceOptions: {
          calcs: ['lastNotNull'],
        },
        showThresholdLabels: false,
        showThresholdMarkers: true,
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: FieldColorModeId.Fixed,
            fixedColor: 'blue',
          },
        },
        overrides: [],
      },
      pluginVersion: '12.3.0',
      type: 'gauge',
    } as Omit<PanelModel, 'fieldConfig'>;

    const result = gaugePanelMigrationHandler(panel as PanelModel);
    expect(result.showThresholdMarkers).toBe(false);
    expect(result.sparkline).toBe(false);
  });

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

    // Ignored due to the API change
    //@ts-ignore
    expect(result.reduceOptions.defaults).toBeUndefined();
    // Ignored due to the API change
    //@ts-ignore
    expect(result.reduceOptions.overrides).toBeUndefined();

    expect((panel as PanelModel).fieldConfig).toMatchSnapshot();
  });

  it('change from angular singlestat to gauge', () => {
    const old = {
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
    const newOptions = gaugePanelChangedHandler(panel, 'singlestat', old, { defaults: {}, overrides: [] });
    expect(panel.fieldConfig.defaults.unit).toBe('ms');
    expect(panel.fieldConfig.defaults.min).toBe(-10);
    expect(panel.fieldConfig.defaults.max).toBe(150);
    expect(panel.fieldConfig.defaults.decimals).toBe(7);
    expect(newOptions.showThresholdMarkers).toBe(true);
    expect(newOptions.showThresholdLabels).toBe(true);
  });
});
