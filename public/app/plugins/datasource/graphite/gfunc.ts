import _ from 'lodash';
import { isVersionGtOrEq } from 'app/core/utils/version';
import { InterpolateFunction } from '@grafana/data';

const index: any = {};

export interface FuncDef {
  name: any;
  category?: string;
  params?: any;
  defaultParams?: any;
  shortName?: any;
  fake?: boolean;
  version?: string;
  description?: string;
}

function addFuncDef(funcDef: FuncDef) {
  funcDef.params = funcDef.params || [];
  funcDef.defaultParams = funcDef.defaultParams || [];

  index[funcDef.name] = funcDef;
  if (funcDef.shortName) {
    index[funcDef.shortName] = funcDef;
  }
}

const optionalSeriesRefArgs = [{ name: 'other', type: 'value_or_series', optional: true, multiple: true }];

addFuncDef({
  name: 'scaleToSeconds',
  category: 'Transform',
  params: [{ name: 'seconds', type: 'int' }],
  defaultParams: [1],
});

addFuncDef({
  name: 'perSecond',
  category: 'Transform',
  params: [{ name: 'max value', type: 'int', optional: true }],
  defaultParams: [],
});

addFuncDef({
  name: 'holtWintersForecast',
  category: 'Calculate',
});

addFuncDef({
  name: 'holtWintersConfidenceBands',
  category: 'Calculate',
  params: [{ name: 'delta', type: 'int' }],
  defaultParams: [3],
});

addFuncDef({
  name: 'holtWintersAberration',
  category: 'Calculate',
  params: [{ name: 'delta', type: 'int' }],
  defaultParams: [3],
});

addFuncDef({
  name: 'nPercentile',
  category: 'Calculate',
  params: [{ name: 'Nth percentile', type: 'int' }],
  defaultParams: [95],
});

addFuncDef({
  name: 'diffSeries',
  params: optionalSeriesRefArgs,
  defaultParams: ['#A'],
  category: 'Combine',
});

addFuncDef({
  name: 'stddevSeries',
  params: optionalSeriesRefArgs,
  defaultParams: [''],
  category: 'Combine',
});

addFuncDef({
  name: 'divideSeries',
  params: optionalSeriesRefArgs,
  defaultParams: ['#A'],
  category: 'Combine',
});

addFuncDef({
  name: 'multiplySeries',
  params: optionalSeriesRefArgs,
  defaultParams: ['#A'],
  category: 'Combine',
});

addFuncDef({
  name: 'asPercent',
  params: optionalSeriesRefArgs,
  defaultParams: ['#A'],
  category: 'Combine',
});

addFuncDef({
  name: 'group',
  params: optionalSeriesRefArgs,
  defaultParams: ['#A', '#B'],
  category: 'Combine',
});

addFuncDef({
  name: 'sumSeries',
  shortName: 'sum',
  category: 'Combine',
  params: optionalSeriesRefArgs,
  defaultParams: [''],
});

addFuncDef({
  name: 'averageSeries',
  shortName: 'avg',
  category: 'Combine',
  params: optionalSeriesRefArgs,
  defaultParams: [''],
});

addFuncDef({
  name: 'rangeOfSeries',
  category: 'Combine',
});

addFuncDef({
  name: 'percentileOfSeries',
  category: 'Combine',
  params: [{ name: 'n', type: 'int' }, { name: 'interpolate', type: 'boolean', options: ['true', 'false'] }],
  defaultParams: [95, 'false'],
});

addFuncDef({
  name: 'sumSeriesWithWildcards',
  category: 'Combine',
  params: [{ name: 'node', type: 'int', multiple: true }],
  defaultParams: [3],
});

addFuncDef({
  name: 'maxSeries',
  shortName: 'max',
  category: 'Combine',
});

addFuncDef({
  name: 'minSeries',
  shortName: 'min',
  category: 'Combine',
});

addFuncDef({
  name: 'averageSeriesWithWildcards',
  category: 'Combine',
  params: [{ name: 'node', type: 'int', multiple: true }],
  defaultParams: [3],
});

addFuncDef({
  name: 'alias',
  category: 'Alias',
  params: [{ name: 'alias', type: 'string' }],
  defaultParams: ['alias'],
});

addFuncDef({
  name: 'aliasSub',
  category: 'Alias',
  params: [{ name: 'search', type: 'string' }, { name: 'replace', type: 'string' }],
  defaultParams: ['', '\\1'],
});

addFuncDef({
  name: 'consolidateBy',
  category: 'Special',
  params: [
    {
      name: 'function',
      type: 'string',
      options: ['sum', 'average', 'min', 'max'],
    },
  ],
  defaultParams: ['max'],
});

addFuncDef({
  name: 'cumulative',
  category: 'Special',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'groupByNode',
  category: 'Combine',
  params: [
    {
      name: 'node',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
    {
      name: 'function',
      type: 'string',
      options: ['sum', 'avg', 'maxSeries'],
    },
  ],
  defaultParams: [3, 'sum'],
});

addFuncDef({
  name: 'aliasByNode',
  category: 'Alias',
  params: [
    {
      name: 'node',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
      multiple: true,
    },
  ],
  defaultParams: [3],
});

addFuncDef({
  name: 'substr',
  category: 'Special',
  params: [
    {
      name: 'start',
      type: 'int',
      options: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
    {
      name: 'stop',
      type: 'int',
      options: [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
  ],
  defaultParams: [0, 0],
});

addFuncDef({
  name: 'sortByName',
  category: 'Sorting',
  params: [
    {
      name: 'natural',
      type: 'boolean',
      options: ['true', 'false'],
      optional: true,
    },
  ],
  defaultParams: ['false'],
});

addFuncDef({
  name: 'sortByMaxima',
  category: 'Sorting',
});

addFuncDef({
  name: 'sortByMinima',
  category: 'Sorting',
});

addFuncDef({
  name: 'sortByTotal',
  category: 'Sorting',
});

addFuncDef({
  name: 'aliasByMetric',
  category: 'Alias',
});

addFuncDef({
  name: 'randomWalk',
  fake: true,
  category: 'Special',
  params: [{ name: 'name', type: 'string' }],
  defaultParams: ['randomWalk'],
});

addFuncDef({
  name: 'countSeries',
  category: 'Combine',
});

addFuncDef({
  name: 'constantLine',
  category: 'Special',
  params: [{ name: 'value', type: 'int' }],
  defaultParams: [10],
});

addFuncDef({
  name: 'cactiStyle',
  category: 'Special',
});

addFuncDef({
  name: 'keepLastValue',
  category: 'Transform',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [100],
});

addFuncDef({
  name: 'changed',
  category: 'Special',
  params: [],
  defaultParams: [],
});

addFuncDef({
  name: 'scale',
  category: 'Transform',
  params: [{ name: 'factor', type: 'int' }],
  defaultParams: [1],
});

addFuncDef({
  name: 'offset',
  category: 'Transform',
  params: [{ name: 'amount', type: 'int' }],
  defaultParams: [10],
});

addFuncDef({
  name: 'transformNull',
  category: 'Transform',
  params: [{ name: 'amount', type: 'int' }],
  defaultParams: [0],
});

addFuncDef({
  name: 'integral',
  category: 'Transform',
});

addFuncDef({
  name: 'derivative',
  category: 'Transform',
});

addFuncDef({
  name: 'nonNegativeDerivative',
  category: 'Transform',
  params: [{ name: 'max value or 0', type: 'int', optional: true }],
  defaultParams: [''],
});

addFuncDef({
  name: 'timeShift',
  category: 'Transform',
  params: [
    {
      name: 'amount',
      type: 'select',
      options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'],
    },
  ],
  defaultParams: ['1d'],
});

addFuncDef({
  name: 'timeStack',
  category: 'Transform',
  params: [
    {
      name: 'timeShiftUnit',
      type: 'select',
      options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'],
    },
    { name: 'timeShiftStart', type: 'int' },
    { name: 'timeShiftEnd', type: 'int' },
  ],
  defaultParams: ['1d', 0, 7],
});

addFuncDef({
  name: 'summarize',
  category: 'Transform',
  params: [
    { name: 'interval', type: 'string' },
    {
      name: 'func',
      type: 'select',
      options: ['sum', 'avg', 'min', 'max', 'last'],
    },
    {
      name: 'alignToFrom',
      type: 'boolean',
      optional: true,
      options: ['false', 'true'],
    },
  ],
  defaultParams: ['1h', 'sum', 'false'],
});

addFuncDef({
  name: 'smartSummarize',
  category: 'Transform',
  params: [
    { name: 'interval', type: 'string' },
    {
      name: 'func',
      type: 'select',
      options: ['sum', 'avg', 'min', 'max', 'last'],
    },
  ],
  defaultParams: ['1h', 'sum'],
});

addFuncDef({
  name: 'absolute',
  category: 'Transform',
});

addFuncDef({
  name: 'hitcount',
  category: 'Transform',
  params: [{ name: 'interval', type: 'string' }],
  defaultParams: ['10s'],
});

addFuncDef({
  name: 'log',
  category: 'Transform',
  params: [{ name: 'base', type: 'int' }],
  defaultParams: ['10'],
});

addFuncDef({
  name: 'averageAbove',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [25],
});

addFuncDef({
  name: 'averageBelow',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [25],
});

addFuncDef({
  name: 'currentAbove',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [25],
});

addFuncDef({
  name: 'currentBelow',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [25],
});

addFuncDef({
  name: 'maximumAbove',
  category: 'Filter Series',
  params: [{ name: 'value', type: 'int' }],
  defaultParams: [0],
});

addFuncDef({
  name: 'maximumBelow',
  category: 'Filter Series',
  params: [{ name: 'value', type: 'int' }],
  defaultParams: [0],
});

addFuncDef({
  name: 'minimumAbove',
  category: 'Filter Series',
  params: [{ name: 'value', type: 'int' }],
  defaultParams: [0],
});

addFuncDef({
  name: 'minimumBelow',
  category: 'Filter Series',
  params: [{ name: 'value', type: 'int' }],
  defaultParams: [0],
});

addFuncDef({
  name: 'limit',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'mostDeviant',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [10],
});

addFuncDef({
  name: 'exclude',
  category: 'Filter Series',
  params: [{ name: 'exclude', type: 'string' }],
  defaultParams: ['exclude'],
});

addFuncDef({
  name: 'highestCurrent',
  category: 'Filter Series',
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'highestMax',
  category: 'Filter Series',
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'lowestCurrent',
  category: 'Filter Series',
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'movingAverage',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: [10],
});

addFuncDef({
  name: 'movingMedian',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: ['5'],
});

addFuncDef({
  name: 'stdev',
  category: 'Calculate',
  params: [{ name: 'n', type: 'int' }, { name: 'tolerance', type: 'int' }],
  defaultParams: [5, 0.1],
});

addFuncDef({
  name: 'highestAverage',
  category: 'Filter Series',
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'lowestAverage',
  category: 'Filter Series',
  params: [{ name: 'count', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'removeAbovePercentile',
  category: 'Filter Data',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'removeAboveValue',
  category: 'Filter Data',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'removeBelowPercentile',
  category: 'Filter Data',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'removeBelowValue',
  category: 'Filter Data',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [5],
});

addFuncDef({
  name: 'useSeriesAbove',
  category: 'Filter Series',
  params: [{ name: 'value', type: 'int' }, { name: 'search', type: 'string' }, { name: 'replace', type: 'string' }],
  defaultParams: [0, 'search', 'replace'],
});

////////////////////
// Graphite 1.0.x //
////////////////////

addFuncDef({
  name: 'aggregateLine',
  category: 'Calculate',
  params: [
    {
      name: 'func',
      type: 'select',
      options: ['sum', 'avg', 'min', 'max', 'last'],
    },
  ],
  defaultParams: ['avg'],
  version: '1.0',
});

addFuncDef({
  name: 'averageOutsidePercentile',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [95],
  version: '1.0',
});

addFuncDef({
  name: 'delay',
  category: 'Transform',
  params: [{ name: 'steps', type: 'int' }],
  defaultParams: [1],
  version: '1.0',
});

addFuncDef({
  name: 'exponentialMovingAverage',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: [10],
  version: '1.0',
});

addFuncDef({
  name: 'fallbackSeries',
  category: 'Special',
  params: [{ name: 'fallback', type: 'string' }],
  defaultParams: ['constantLine(0)'],
  version: '1.0',
});

addFuncDef({
  name: 'grep',
  category: 'Filter Series',
  params: [{ name: 'grep', type: 'string' }],
  defaultParams: ['grep'],
  version: '1.0',
});

addFuncDef({
  name: 'groupByNodes',
  category: 'Combine',
  params: [
    {
      name: 'function',
      type: 'string',
      options: ['sum', 'avg', 'maxSeries'],
    },
    {
      name: 'node',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
      multiple: true,
    },
  ],
  defaultParams: ['sum', 3],
  version: '1.0',
});

addFuncDef({
  name: 'integralByInterval',
  category: 'Transform',
  params: [
    {
      name: 'intervalUnit',
      type: 'select',
      options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'],
    },
  ],
  defaultParams: ['1d'],
  version: '1.0',
});

addFuncDef({
  name: 'interpolate',
  category: 'Transform',
  params: [{ name: 'limit', type: 'int', optional: true }],
  defaultParams: [],
  version: '1.0',
});

addFuncDef({
  name: 'invert',
  category: 'Transform',
  version: '1.0',
});

addFuncDef({
  name: 'isNonNull',
  category: 'Combine',
  version: '1.0',
});

addFuncDef({
  name: 'linearRegression',
  category: 'Calculate',
  params: [
    {
      name: 'startSourceAt',
      type: 'select',
      options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'],
      optional: true,
    },
    {
      name: 'endSourceAt',
      type: 'select',
      options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'],
      optional: true,
    },
  ],
  defaultParams: [],
  version: '1.0',
});

addFuncDef({
  name: 'mapSeries',
  shortName: 'map',
  params: [{ name: 'node', type: 'int' }],
  defaultParams: [3],
  category: 'Combine',
  version: '1.0',
});

addFuncDef({
  name: 'movingMin',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: [10],
  version: '1.0',
});

addFuncDef({
  name: 'movingMax',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: [10],
  version: '1.0',
});

addFuncDef({
  name: 'movingSum',
  category: 'Calculate',
  params: [
    {
      name: 'windowSize',
      type: 'int_or_interval',
      options: ['5', '7', '10', '5min', '10min', '30min', '1hour'],
    },
  ],
  defaultParams: [10],
  version: '1.0',
});

addFuncDef({
  name: 'multiplySeriesWithWildcards',
  category: 'Combine',
  params: [
    {
      name: 'position',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
      multiple: true,
    },
  ],
  defaultParams: [2],
  version: '1.0',
});

addFuncDef({
  name: 'offsetToZero',
  category: 'Transform',
  version: '1.0',
});

addFuncDef({
  name: 'pow',
  category: 'Transform',
  params: [{ name: 'factor', type: 'int' }],
  defaultParams: [10],
  version: '1.0',
});

addFuncDef({
  name: 'powSeries',
  category: 'Transform',
  params: optionalSeriesRefArgs,
  defaultParams: [''],
  version: '1.0',
});

addFuncDef({
  name: 'reduceSeries',
  shortName: 'reduce',
  params: [
    {
      name: 'function',
      type: 'string',
      options: ['asPercent', 'diffSeries', 'divideSeries'],
    },
    {
      name: 'reduceNode',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    },
    { name: 'reduceMatchers', type: 'string', multiple: true },
  ],
  defaultParams: ['asPercent', 2, 'used_bytes'],
  category: 'Combine',
  version: '1.0',
});

addFuncDef({
  name: 'removeBetweenPercentile',
  category: 'Filter Series',
  params: [{ name: 'n', type: 'int' }],
  defaultParams: [95],
  version: '1.0',
});

addFuncDef({
  name: 'removeEmptySeries',
  category: 'Filter Series',
  version: '1.0',
});

addFuncDef({
  name: 'squareRoot',
  category: 'Transform',
  version: '1.0',
});

addFuncDef({
  name: 'timeSlice',
  category: 'Transform',
  params: [
    {
      name: 'startSliceAt',
      type: 'select',
      options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'],
    },
    {
      name: 'endSliceAt',
      type: 'select',
      options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'],
      optional: true,
    },
  ],
  defaultParams: ['-1h'],
  version: '1.0',
});

addFuncDef({
  name: 'weightedAverage',
  category: 'Combine',
  params: [
    { name: 'other', type: 'value_or_series', optional: true },
    {
      name: 'node',
      type: 'int',
      options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12],
    },
  ],
  defaultParams: ['#A', 4],
  version: '1.0',
});

addFuncDef({
  name: 'seriesByTag',
  category: 'Special',
  params: [{ name: 'tagExpression', type: 'string', multiple: true }],
  version: '1.1',
});

addFuncDef({
  name: 'groupByTags',
  category: 'Combine',
  params: [
    {
      name: 'function',
      type: 'string',
      options: ['sum', 'avg', 'maxSeries'],
    },
    { name: 'tag', type: 'string', multiple: true },
  ],
  defaultParams: ['sum', 'tag'],
  version: '1.1',
});

addFuncDef({
  name: 'aliasByTags',
  category: 'Alias',
  params: [{ name: 'tag', type: 'string', multiple: true }],
  defaultParams: ['tag'],
  version: '1.1',
});

function isVersionRelatedFunction(obj: { version: string }, graphiteVersion: string) {
  return !obj.version || isVersionGtOrEq(graphiteVersion, obj.version);
}

export class FuncInstance {
  def: any;
  params: any;
  text: any;
  added: boolean;

  constructor(funcDef: any, options: { withDefaultParams: any }) {
    this.def = funcDef;
    this.params = [];

    if (options && options.withDefaultParams) {
      this.params = funcDef.defaultParams.slice(0);
    }

    this.updateText();
  }

  render(metricExp: string, replaceVariables: InterpolateFunction): string {
    const str = this.def.name + '(';

    const parameters = _.map(this.params, (value, index) => {
      let paramType;

      if (index < this.def.params.length) {
        paramType = this.def.params[index].type;
      } else if (_.get(_.last(this.def.params), 'multiple')) {
        paramType = _.get(_.last(this.def.params), 'type');
      }

      // param types that should never be quoted
      if (_.includes(['value_or_series', 'boolean', 'int', 'float', 'node'], paramType)) {
        return value;
      }

      const valueInterpolated = _.isString(value) ? replaceVariables(value) : value;

      // param types that might be quoted
      // To quote variables correctly we need to interpolate it to check if it contains a numeric or string value
      if (_.includes(['int_or_interval', 'node_or_tag'], paramType) && _.isFinite(+valueInterpolated)) {
        return _.toString(value);
      }

      return "'" + value + "'";
    });

    // don't send any blank parameters to graphite
    while (parameters[parameters.length - 1] === '') {
      parameters.pop();
    }

    if (metricExp) {
      parameters.unshift(metricExp);
    }

    return str + parameters.join(', ') + ')';
  }

  _hasMultipleParamsInString(strValue: any, index: number) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    if (this.def.params[index + 1] && this.def.params[index + 1].optional) {
      return true;
    }

    if (index + 1 >= this.def.params.length && _.get(_.last(this.def.params), 'multiple')) {
      return true;
    }

    return false;
  }

  updateParam(strValue: any, index: any) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this._hasMultipleParamsInString(strValue, index)) {
      _.each(strValue.split(','), (partVal, idx) => {
        this.updateParam(partVal.trim(), index + idx);
      });
      return;
    }

    if (strValue === '' && (index >= this.def.params.length || this.def.params[index].optional)) {
      this.params.splice(index, 1);
    } else {
      this.params[index] = strValue;
    }

    this.updateText();
  }

  updateText() {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    let text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  }
}

function createFuncInstance(funcDef: any, options?: { withDefaultParams: any }, idx?: any) {
  if (_.isString(funcDef)) {
    funcDef = getFuncDef(funcDef, idx);
  }
  return new FuncInstance(funcDef, options);
}

function getFuncDef(name: string, idx?: any) {
  if (!(idx || index)[name]) {
    throw { message: 'Method not found ' + name };
  }
  return (idx || index)[name];
}

function getFuncDefs(graphiteVersion: string, idx?: any) {
  const funcs: any = {};
  _.forEach(idx || index, funcDef => {
    if (isVersionRelatedFunction(funcDef, graphiteVersion)) {
      funcs[funcDef.name] = _.assign({}, funcDef, {
        params: _.filter(funcDef.params, param => {
          return isVersionRelatedFunction(param, graphiteVersion);
        }),
      });
    }
  });
  return funcs;
}

// parse response from graphite /functions endpoint into internal format
function parseFuncDefs(rawDefs: any) {
  const funcDefs: any = {};

  _.forEach(rawDefs || {}, (funcDef, funcName) => {
    // skip graphite graph functions
    if (funcDef.group === 'Graph') {
      return;
    }

    let description = funcDef.description;
    if (description) {
      // tidy up some pydoc syntax that rst2html can't handle
      description = description
        .replace(/:py:func:`(.+)( <[^>]*>)?`/g, '``$1``')
        .replace(/.. seealso:: /g, 'See also: ')
        .replace(/.. code-block *:: *none/g, '.. code-block::');
    }

    const func: FuncDef = {
      name: funcDef.name,
      description,
      category: funcDef.group,
      params: [],
      defaultParams: [],
      fake: false,
    };

    // get rid of the first "seriesList" param
    if (/^seriesLists?$/.test(_.get(funcDef, 'params[0].type', ''))) {
      // handle functions that accept multiple seriesLists
      // we leave the param in place but mark it optional, so users can add more series if they wish
      if (funcDef.params[0].multiple) {
        funcDef.params[0].required = false;
        // otherwise chop off the first param, it'll be handled separately
      } else {
        funcDef.params.shift();
      }
      // tag function as fake
    } else {
      func.fake = true;
    }

    _.forEach(funcDef.params, rawParam => {
      const param: any = {
        name: rawParam.name,
        type: 'string',
        optional: !rawParam.required,
        multiple: !!rawParam.multiple,
        options: undefined,
      };

      if (rawParam.default !== undefined) {
        func.defaultParams.push(_.toString(rawParam.default));
      } else if (rawParam.suggestions) {
        func.defaultParams.push(_.toString(rawParam.suggestions[0]));
      } else {
        func.defaultParams.push('');
      }

      if (rawParam.type === 'boolean') {
        param.type = 'boolean';
        param.options = ['true', 'false'];
      } else if (rawParam.type === 'integer') {
        param.type = 'int';
      } else if (rawParam.type === 'float') {
        param.type = 'float';
      } else if (rawParam.type === 'node') {
        param.type = 'node';
        param.options = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      } else if (rawParam.type === 'nodeOrTag') {
        param.type = 'node_or_tag';
        param.options = ['name', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      } else if (rawParam.type === 'intOrInterval') {
        param.type = 'int_or_interval';
      } else if (rawParam.type === 'seriesList') {
        param.type = 'value_or_series';
      }

      if (rawParam.options) {
        param.options = _.map(rawParam.options, _.toString);
      } else if (rawParam.suggestions) {
        param.options = _.map(rawParam.suggestions, _.toString);
      }

      func.params.push(param);
    });

    funcDefs[funcName] = func;
  });

  return funcDefs;
}

export default {
  createFuncInstance: createFuncInstance,
  getFuncDef: getFuncDef,
  getFuncDefs: getFuncDefs,
  parseFuncDefs: parseFuncDefs,
};
