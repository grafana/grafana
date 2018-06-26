import { MultistatPanelOptions, MultistatPanelLayout } from './types';

const panelDefaults: MultistatPanelOptions = {
  links: [],
  datasource: null,
  maxDataPoints: 100,
  interval: null,
  targets: [{}],
  cacheTimeout: null,
  format: 'none',
  mappingType: 1,
  nullPointMode: 'connected',
  valueName: 'avg',
  thresholds: '',
  colorBackground: false,
  colorValue: false,
  colors: ['#299c46', 'rgba(237, 129, 40, 0.89)', '#d44a3a'],
  sparkline: {
    show: false,
    full: false,
    lineColor: 'rgb(31, 120, 193)',
    fillColor: 'rgba(31, 118, 189, 0.18)',
  },
  layout: MultistatPanelLayout.Horizontal,
};

const valueNameOptions = [
  { value: 'min', text: 'Min' },
  { value: 'max', text: 'Max' },
  { value: 'avg', text: 'Average' },
  { value: 'current', text: 'Current' },
  { value: 'total', text: 'Total' },
  { value: 'name', text: 'Name' },
  { value: 'first', text: 'First' },
  { value: 'delta', text: 'Delta' },
  { value: 'diff', text: 'Difference' },
  { value: 'range', text: 'Range' },
  { value: 'last_time', text: 'Time of last point' },
];

const defaults = {
  panelDefaults,
  valueNameOptions,
};

export default defaults;
