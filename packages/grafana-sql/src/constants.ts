import { Func, FuncParameter } from './types';

export const COMMON_FNS: Func[] = [
  { name: 'AVG' },
  { name: 'COUNT' },
  { name: 'MAX' },
  { name: 'MIN' },
  { name: 'SUM' },
];

const intervalParam: FuncParameter = {
  name: 'Interval',
  required: true,
  options: () => {
    return Promise.resolve([{ label: '$__interval', value: '$__interval' }]);
  },
};
const fillParam: FuncParameter = {
  name: 'Fill',
  required: false,
  options: () =>
    Promise.resolve([
      { label: '0', value: '0' },
      { label: 'NULL', value: 'NULL' },
      { label: 'previous', value: 'previous' },
    ]),
};

export const MACRO_FUNCTIONS = (columnParam: FuncParameter) => [
  {
    name: '$__timeGroup',
    description: 'Time grouping function',
    parameters: [columnParam, intervalParam, fillParam],
  },
  {
    name: '$__timeGroupAlias',
    description: 'Time grouping function with time as alias',
    parameters: [columnParam, intervalParam, fillParam],
  },
  {
    name: '$__time',
    description: 'An expression to rename the column to time',
    parameters: [columnParam],
  },
  {
    name: '$__timeEpoch',
    parameters: [columnParam],
  },
  {
    name: '$__unixEpochGroup',
    parameters: [columnParam, intervalParam, fillParam],
  },
  {
    name: '$__unixEpochGroupAlias',
    parameters: [columnParam, intervalParam, fillParam],
  },
];

export const MACRO_NAMES = [
  '$__time',
  '$__timeEpoch',
  '$__timeFilter',
  '$__timeFrom',
  '$__timeTo',
  '$__timeGroup',
  '$__timeGroupAlias',
  '$__unixEpochFilter',
  '$__unixEpochNanoFilter',
  '$__unixEpochNanoFrom',
  '$__unixEpochNanoTo',
  '$__unixEpochGroup',
  '$__unixEpochGroupAlias',
];
