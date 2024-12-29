import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { timelinePanelChangedHandler } from './migrations';

describe('Timeline Migrations', () => {
  it('from discrete panel', () => {
    const panel = {} as PanelModel;
    panel.options = timelinePanelChangedHandler(panel, 'natel-discrete-panel', { angular: discreteInV8 });
    expect(panel).toMatchSnapshot();
  });
});

const discreteInV8 = {
  id: 23763571993,
  gridPos: {
    h: 8,
    w: 12,
    x: 0,
    y: 0,
  },
  type: 'natel-discrete-panel',
  title: 'Panel Title',
  backgroundColor: 'rgba(128,128,128,0.1)',
  colorMaps: [
    {
      $$hashKey: 'object:365',
      color: '#7EB26D',
      text: '1',
    },
    {
      $$hashKey: 'object:366',
      color: '#EAB839',
      text: '20',
    },
    {
      $$hashKey: 'object:367',
      color: '#6ED0E0',
      text: '90',
    },
    {
      $$hashKey: 'object:368',
      color: '#EF843C',
      text: '30',
    },
    {
      $$hashKey: 'object:369',
      color: '#E24D42',
      text: '5',
    },
  ],
  crosshairColor: '#8F070C',
  display: 'timeline',
  extendLastValue: true,
  highlightOnMouseover: true,
  legendSortBy: '-ms',
  lineColor: 'rgba(0,0,0,0.1)',
  metricNameColor: '#000000',
  rangeMaps: [
    {
      $$hashKey: 'object:267',
      from: '1',
      text: 'AAA',
      to: '3',
    },
    {
      from: '4',
      to: '5',
      text: 'BBB',
      $$hashKey: 'object:544',
    },
  ],
  rowHeight: 50,
  showLegend: true,
  showLegendNames: true,
  showLegendPercent: true,
  showLegendValues: true,
  showTimeAxis: true,
  targets: [
    {
      refId: 'A',
      scenarioId: 'csv_metric_values',
      stringInput: '1,20,90,30,5,0',
    },
    {
      scenarioId: 'csv_metric_values',
      refId: 'B',
      stringInput: '1,20,30,5,0',
      hide: false,
    },
  ],
  textSize: 24,
  textSizeTime: 12,
  timeOptions: [
    {
      name: 'Years',
      value: 'years',
    },
    {
      name: 'Months',
      value: 'months',
    },
    {
      name: 'Weeks',
      value: 'weeks',
    },
    {
      name: 'Days',
      value: 'days',
    },
    {
      name: 'Hours',
      value: 'hours',
    },
    {
      name: 'Minutes',
      value: 'minutes',
    },
    {
      name: 'Seconds',
      value: 'seconds',
    },
    {
      name: 'Milliseconds',
      value: 'milliseconds',
    },
  ],
  timePrecision: {
    name: 'Minutes',
    value: 'minutes',
  },
  timeTextColor: '#d8d9da',
  units: 'currencyGBP',
  valueMaps: [
    {
      $$hashKey: 'object:265',
      op: '=',
      text: 'ONE',
      value: '111',
    },
    {
      value: '222',
      op: '=',
      text: 'TWO',
      $$hashKey: 'object:546',
    },
  ],
  valueTextColor: '#000000',
  writeLastValue: true,
  expandFromQueryS: 0,
  use12HourClock: false,
  useTimePrecision: false,
  writeAllValues: false,
  writeMetricNames: false,
  datasource: null,
};
