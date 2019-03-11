import { TableData } from '../../types/data';
import { ColumnStyle } from './TableCellBuilder';

import { getColorDefinitionByName } from '@grafana/ui';

const SemiDarkOrange = getColorDefinitionByName('semi-dark-orange');

export const migratedTestTable = {
  type: 'table',
  columns: [
    { text: 'Time' },
    { text: 'Value' },
    { text: 'Colored' },
    { text: 'Undefined' },
    { text: 'String' },
    { text: 'United', unit: 'bps' },
    { text: 'Sanitized' },
    { text: 'Link' },
    { text: 'Array' },
    { text: 'Mapping' },
    { text: 'RangeMapping' },
    { text: 'MappingColored' },
    { text: 'RangeMappingColored' },
  ],
  rows: [[1388556366666, 1230, 40, undefined, '', '', 'my.host.com', 'host1', ['value1', 'value2'], 1, 2, 1, 2]],
} as TableData;

export const migratedTestStyles: ColumnStyle[] = [
  {
    pattern: 'Time',
    type: 'date',
    alias: 'Timestamp',
  },
  {
    pattern: '/(Val)ue/',
    type: 'number',
    unit: 'ms',
    decimals: 3,
    alias: '$1',
  },
  {
    pattern: 'Colored',
    type: 'number',
    unit: 'none',
    decimals: 1,
    colorMode: 'value',
    thresholds: [50, 80],
    colors: ['#00ff00', SemiDarkOrange.name, 'rgb(1,0,0)'],
  },
  {
    pattern: 'String',
    type: 'string',
  },
  {
    pattern: 'String',
    type: 'string',
  },
  {
    pattern: 'United',
    type: 'number',
    unit: 'ms',
    decimals: 2,
  },
  {
    pattern: 'Sanitized',
    type: 'string',
    sanitize: true,
  },
  {
    pattern: 'Link',
    type: 'string',
    link: true,
    linkUrl: '/dashboard?param=$__cell&param_1=$__cell_1&param_2=$__cell_2',
    linkTooltip: '$__cell $__cell_1 $__cell_6',
    linkTargetBlank: true,
  },
  {
    pattern: 'Array',
    type: 'number',
    unit: 'ms',
    decimals: 3,
  },
  {
    pattern: 'Mapping',
    type: 'string',
    mappingType: 1,
    valueMaps: [
      {
        value: '1',
        text: 'on',
      },
      {
        value: '0',
        text: 'off',
      },
      {
        value: 'HELLO WORLD',
        text: 'HELLO GRAFANA',
      },
      {
        value: 'value1, value2',
        text: 'value3, value4',
      },
    ],
  },
  {
    pattern: 'RangeMapping',
    type: 'string',
    mappingType: 2,
    rangeMaps: [
      {
        from: '1',
        to: '3',
        text: 'on',
      },
      {
        from: '3',
        to: '6',
        text: 'off',
      },
    ],
  },
  {
    pattern: 'MappingColored',
    type: 'string',
    mappingType: 1,
    valueMaps: [
      {
        value: '1',
        text: 'on',
      },
      {
        value: '0',
        text: 'off',
      },
    ],
    colorMode: 'value',
    thresholds: [1, 2],
    colors: ['#00ff00', SemiDarkOrange.name, 'rgb(1,0,0)'],
  },
  {
    pattern: 'RangeMappingColored',
    type: 'string',
    mappingType: 2,
    rangeMaps: [
      {
        from: '1',
        to: '3',
        text: 'on',
      },
      {
        from: '3',
        to: '6',
        text: 'off',
      },
    ],
    colorMode: 'value',
    thresholds: [2, 5],
    colors: ['#00ff00', SemiDarkOrange.name, 'rgb(1,0,0)'],
  },
];

export const simpleTable = {
  type: 'table',
  columns: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }],
  rows: [[701, 205, 305], [702, 206, 301], [703, 207, 304]],
};
