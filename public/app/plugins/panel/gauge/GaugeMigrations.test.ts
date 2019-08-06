import { PanelModel } from '@grafana/ui';
import { gaugePanelMigrationCheck } from './GaugeMigrations';

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

    expect(gaugePanelMigrationCheck(panel)).toMatchSnapshot();
  });
});
