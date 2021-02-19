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
            value: null,
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
    } as PanelModel;

    expect(gaugePanelMigrationHandler(panel)).toMatchSnapshot();
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

    const newOptions = gaugePanelChangedHandler({} as any, 'singlestat', old);
    expect(newOptions.fieldOptions.defaults.unit).toBe('ms');
    expect(newOptions.fieldOptions.defaults.min).toBe(-10);
    expect(newOptions.fieldOptions.defaults.max).toBe(150);
    expect(newOptions.fieldOptions.defaults.decimals).toBe(7);
    expect(newOptions.showThresholdMarkers).toBe(true);
    expect(newOptions.showThresholdLabels).toBe(true);
  });

  it('change from angular singlestatt with no enabled gauge', () => {
    const old: any = {
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

    const newOptions = gaugePanelChangedHandler({} as any, 'singlestat', old);
    expect(newOptions.fieldOptions.defaults.unit).toBe('ms');
    expect(newOptions.fieldOptions.defaults.min).toBe(undefined);
    expect(newOptions.fieldOptions.defaults.max).toBe(undefined);
  });
});
