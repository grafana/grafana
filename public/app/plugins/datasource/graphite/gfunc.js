define([
  'lodash',
  'jquery'
],
function (_, $) {
  'use strict';

  var index = [];
  var categories = {
    Combine: [],
    Transform: [],
    Calculate: [],
    Filter: [],
    Special: []
  };

  function addFuncDef(funcDef) {
    funcDef.params = funcDef.params || [];
    funcDef.defaultParams = funcDef.defaultParams || [];

    if (funcDef.category) {
      funcDef.category.push(funcDef);
    }
    index[funcDef.name] = funcDef;
    index[funcDef.shortName || funcDef.name] = funcDef;
  }

  var optionalSeriesRefArgs = [
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true },
    { name: 'other', type: 'value_or_series', optional: true }
  ];

  addFuncDef({
    name: 'scaleToSeconds',
    category: categories.Transform,
    params: [{ name: 'seconds', type: 'int' }],
    defaultParams: [1],
  });

  addFuncDef({
    name: 'perSecond',
    category: categories.Transform,
    params: [{ name: "max value", type: "int", optional: true }],
    defaultParams: [],
  });

  addFuncDef({
    name: "holtWintersForecast",
    category: categories.Calculate,
  });

  addFuncDef({
    name: "holtWintersConfidenceBands",
    category: categories.Calculate,
    params: [{ name: "delta", type: 'int' }],
    defaultParams: [3]
  });

  addFuncDef({
    name: "holtWintersAberration",
    category: categories.Calculate,
    params: [{ name: "delta", type: 'int' }],
    defaultParams: [3]
  });

  addFuncDef({
    name: "nPercentile",
    category: categories.Calculate,
    params: [{ name: "Nth percentile", type: 'int' }],
    defaultParams: [95]
  });

  addFuncDef({
    name: 'diffSeries',
    params: optionalSeriesRefArgs,
    defaultParams: ['#A'],
    category: categories.Calculate,
  });

  addFuncDef({
    name: 'stddevSeries',
    params: optionalSeriesRefArgs,
    defaultParams: [''],
    category: categories.Calculate,
  });

  addFuncDef({
    name: 'divideSeries',
    params: optionalSeriesRefArgs,
    defaultParams: ['#A'],
    category: categories.Calculate,
  });

  addFuncDef({
    name: 'multiplySeries',
    params: optionalSeriesRefArgs,
    defaultParams: ['#A'],
    category: categories.Calculate,
  });

  addFuncDef({
    name: 'asPercent',
    params: optionalSeriesRefArgs,
    defaultParams: ['#A'],
    category: categories.Calculate,
  });

  addFuncDef({
    name: 'group',
    params: optionalSeriesRefArgs,
    defaultParams: ['#A', '#B'],
    category: categories.Combine,
  });

  addFuncDef({
    name: 'sumSeries',
    shortName: 'sum',
    category: categories.Combine,
    params: optionalSeriesRefArgs,
    defaultParams: [''],
  });

  addFuncDef({
    name: 'averageSeries',
    shortName: 'avg',
    category: categories.Combine,
    params: optionalSeriesRefArgs,
    defaultParams: [''],
  });

  addFuncDef({
    name: 'rangeOfSeries',
    category: categories.Combine
  });

  addFuncDef({
    name: 'percentileOfSeries',
    category: categories.Combine,
    params: [{ name: 'n', type: 'int' }, { name: 'interpolate', type: 'boolean', options: ['true', 'false'] }],
    defaultParams: [95, 'false']
  });

  addFuncDef({
    name: 'sumSeriesWithWildcards',
    category: categories.Combine,
    params: [
      { name: "node", type: "int" },
      { name: "node", type: "int", optional: true },
      { name: "node", type: "int", optional: true },
      { name: "node", type: "int", optional: true }
    ],
    defaultParams: [3]
  });

  addFuncDef({
    name: 'maxSeries',
    shortName: 'max',
    category: categories.Combine,
  });

  addFuncDef({
    name: 'minSeries',
    shortName: 'min',
    category: categories.Combine,
  });

  addFuncDef({
    name: 'averageSeriesWithWildcards',
    category: categories.Combine,
    params: [
      { name: "node", type: "int" },
      { name: "node", type: "int", optional: true },
    ],
    defaultParams: [3]
  });

  addFuncDef({
    name: "alias",
    category: categories.Special,
    params: [{ name: "alias", type: 'string' }],
    defaultParams: ['alias']
  });

  addFuncDef({
    name: "aliasSub",
    category: categories.Special,
    params: [{ name: "search", type: 'string' }, { name: "replace", type: 'string' }],
    defaultParams: ['', '\\1']
  });

  addFuncDef({
    name: "stacked",
    category: categories.Special,
    params: [{ name: "stack", type: 'string' }],
    defaultParams: ['stacked']
  });

  addFuncDef({
    name: "consolidateBy",
    category: categories.Special,
    params: [
      {
        name: 'function',
        type: 'string',
        options: ['sum', 'average', 'min', 'max']
      }
    ],
    defaultParams: ['max']
  });

  addFuncDef({
    name: "cumulative",
    category: categories.Special,
    params: [],
    defaultParams: []
  });

  addFuncDef({
    name: "groupByNode",
    category: categories.Special,
    params: [
      {
        name: "node",
        type: "int",
        options: [0,1,2,3,4,5,6,7,8,9,10,12]
      },
      {
        name: "function",
        type: "string",
        options: ['sum', 'avg', 'maxSeries']
      }
    ],
    defaultParams: [3, "sum"]
  });

  addFuncDef({
    name: 'aliasByNode',
    category: categories.Special,
    params: [
      { name: "node", type: "int", options: [0,1,2,3,4,5,6,7,8,9,10,12] },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
    ],
    defaultParams: [3]
  });

  addFuncDef({
    name: 'substr',
    category: categories.Special,
    params: [
      { name: "start", type: "int", options: [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,12] },
      { name: "stop", type: "int", options: [-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,12] },
    ],
    defaultParams: [0, 0]
  });

  addFuncDef({
    name: 'sortByName',
    category: categories.Special,
    params: [{ name: 'natural', type: 'boolean', options: ['true', 'false'], optional: true }],
    defaultParams: ['false']
  });

  addFuncDef({
    name: 'sortByMaxima',
    category: categories.Special
  });

  addFuncDef({
    name: 'sortByMinima',
    category: categories.Special
  });

  addFuncDef({
    name: 'sortByTotal',
    category: categories.Special
  });

  addFuncDef({
    name: 'aliasByMetric',
    category: categories.Special,
  });

  addFuncDef({
    name: 'randomWalk',
    fake: true,
    category: categories.Special,
    params: [{ name: "name", type: "string", }],
    defaultParams: ['randomWalk']
  });

  addFuncDef({
    name: 'countSeries',
    category: categories.Special
  });

  addFuncDef({
    name: 'constantLine',
    category: categories.Special,
    params: [{ name: "value", type: "int", }],
    defaultParams: [10]
  });

  addFuncDef({
    name: 'cactiStyle',
    category: categories.Special,
  });

  addFuncDef({
    name: 'keepLastValue',
    category: categories.Special,
    params: [{ name: "n", type: "int", }],
    defaultParams: [100]
  });

  addFuncDef({
    name: "changed",
    category: categories.Special,
    params: [],
    defaultParams: []
  });

  addFuncDef({
    name: 'scale',
    category: categories.Transform,
    params: [{ name: "factor", type: "int", }],
    defaultParams: [1]
  });

  addFuncDef({
    name: 'offset',
    category: categories.Transform,
    params: [{ name: "amount", type: "int", }],
    defaultParams: [10]
  });

  addFuncDef({
    name: 'transformNull',
    category: categories.Transform,
    params: [{ name: "amount", type: "int", }],
    defaultParams: [0]
  });

  addFuncDef({
    name: 'integral',
    category: categories.Transform,
  });

  addFuncDef({
    name: 'derivative',
    category: categories.Transform,
  });

  addFuncDef({
    name: 'nonNegativeDerivative',
    category: categories.Transform,
    params: [{ name: "max value or 0", type: "int", optional: true }],
    defaultParams: ['']
  });

  addFuncDef({
    name: 'timeShift',
    category: categories.Transform,
    params: [{ name: "amount", type: "select", options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'] }],
    defaultParams: ['1d']
  });

  addFuncDef({
    name: 'timeStack',
    category: categories.Transform,
    params: [
      { name: "timeShiftUnit", type: "select", options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'] },
      { name: "timeShiftStart", type: "int" },
      { name: "timeShiftEnd", type: "int" }
    ],
    defaultParams: ['1d', 0, 7]
  });

  addFuncDef({
    name: 'summarize',
    category: categories.Transform,
    params: [
      { name: "interval", type: "string" },
      { name: "func", type: "select", options: ['sum', 'avg', 'min', 'max', 'last'] },
      { name: "alignToFrom", type: "boolean", optional: true, options: ['false', 'true'] },
    ],
    defaultParams: ['1h', 'sum', 'false']
  });

  addFuncDef({
    name: 'smartSummarize',
    category: categories.Transform,
    params: [{ name: "interval", type: "string" }, { name: "func", type: "select", options: ['sum', 'avg', 'min', 'max', 'last'] }],
    defaultParams: ['1h', 'sum']
  });

  addFuncDef({
    name: 'absolute',
    category: categories.Transform,
  });

  addFuncDef({
    name: 'hitcount',
    category: categories.Transform,
    params: [{ name: "interval", type: "string" }],
    defaultParams: ['10s']
  });

  addFuncDef({
    name: 'log',
    category: categories.Transform,
    params: [{ name: "base", type: "int" }],
    defaultParams: ['10']
  });

  addFuncDef({
    name: 'averageAbove',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [25]
  });

  addFuncDef({
    name: 'averageBelow',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [25]
  });

  addFuncDef({
    name: 'currentAbove',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [25]
  });

  addFuncDef({
    name: 'currentBelow',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [25]
  });

  addFuncDef({
    name: 'maximumAbove',
    category: categories.Filter,
    params: [{ name: "value", type: "int" }],
    defaultParams: [0]
  });

  addFuncDef({
    name: 'maximumBelow',
    category: categories.Filter,
    params: [{ name: "value", type: "int" }],
    defaultParams: [0]
  });

  addFuncDef({
    name: 'minimumAbove',
    category: categories.Filter,
    params: [{ name: "value", type: "int" }],
    defaultParams: [0]
  });

  addFuncDef({
    name: 'minimumBelow',
    category: categories.Filter,
    params: [{ name: "value", type: "int" }],
    defaultParams: [0]
  });

  addFuncDef({
    name: 'limit',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'mostDeviant',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [10]
  });

  addFuncDef({
    name: "exclude",
    category: categories.Filter,
    params: [{ name: "exclude", type: 'string' }],
    defaultParams: ['exclude']
  });

  addFuncDef({
    name: 'highestCurrent',
    category: categories.Filter,
    params: [{ name: "count", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'highestMax',
    category: categories.Filter,
    params: [{ name: "count", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'lowestCurrent',
    category: categories.Filter,
    params: [{ name: "count", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'movingAverage',
    category: categories.Filter,
    params: [{ name: "windowSize", type: "int_or_interval", options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: [10]
  });

  addFuncDef({
    name: 'movingMedian',
    category: categories.Filter,
    params: [{ name: "windowSize", type: "int_or_interval", options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: ['5']
  });

  addFuncDef({
    name: 'stdev',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }, { name: "tolerance", type: "int" }],
    defaultParams: [5,0.1]
  });

  addFuncDef({
    name: 'highestAverage',
    category: categories.Filter,
    params: [{ name: "count", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'lowestAverage',
    category: categories.Filter,
    params: [{ name: "count", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'removeAbovePercentile',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'removeAboveValue',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'removeBelowPercentile',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'removeBelowValue',
    category: categories.Filter,
    params: [{ name: "n", type: "int" }],
    defaultParams: [5]
  });

  addFuncDef({
    name: 'useSeriesAbove',
    category: categories.Filter,
    params: [
      { name: "value", type: "int" },
      { name: "search", type: "string" },
      { name: "replace", type: "string" }
    ],
    defaultParams: [0, 'search', 'replace']
  });

  ////////////////////
  // Graphite 1.0.x //
  ////////////////////

  addFuncDef({
    name: 'aggregateLine',
    category: categories.Combine,
    params: [{ name: "func", type: "select", options: ['sum', 'avg', 'min', 'max', 'last']}],
    defaultParams: ['avg'],
    version: '1.0'
  });

  addFuncDef({
    name: 'averageOutsidePercentile',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [95],
    version: '1.0'
  });

  addFuncDef({
    name: 'delay',
    category: categories.Transform,
    params: [{ name: 'steps', type: 'int', }],
    defaultParams: [1],
    version: '1.0'
  });

  addFuncDef({
    name: 'exponentialMovingAverage',
    category: categories.Calculate,
    params: [{ name: 'windowSize', type: 'int_or_interval', options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: [10],
    version: '1.0'
  });

  addFuncDef({
    name: 'fallbackSeries',
    category: categories.Special,
    params: [{ name: 'fallback', type: 'string' }],
    defaultParams: ['constantLine(0)'],
    version: '1.0'
  });

  addFuncDef({
    name: "grep",
    category: categories.Filter,
    params: [{ name: "grep", type: 'string' }],
    defaultParams: ['grep'],
    version: '1.0'
  });

  addFuncDef({
    name: "groupByNodes",
    category: categories.Special,
    params: [
      {
        name: "function",
        type: "string",
        options: ['sum', 'avg', 'maxSeries']
      },
      { name: "node", type: "int", options: [0,1,2,3,4,5,6,7,8,9,10,12] },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "node", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
    ],
    defaultParams: ["sum", 3],
    version: '1.0'
  });

  addFuncDef({
    name: 'integralByInterval',
    category: categories.Transform,
    params: [{ name: "intervalUnit", type: "select", options: ['1h', '6h', '12h', '1d', '2d', '7d', '14d', '30d'] }],
    defaultParams: ['1d'],
    version: '1.0'
  });

  addFuncDef({
    name: 'interpolate',
    category: categories.Transform,
    params: [{ name: 'limit', type: 'int', optional: true}],
    defaultParams: [],
    version: '1.0'
  });

  addFuncDef({
    name: 'invert',
    category: categories.Transform,
    version: '1.0'
  });

  addFuncDef({
    name: 'isNonNull',
    category: categories.Combine,
    version: '1.0'
  });

  addFuncDef({
    name: 'linearRegression',
    category: categories.Calculate,
    params: [
      { name: "startSourceAt", type: "select", options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'], optional: true },
      { name: "endSourceAt", type: "select", options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'], optional: true }
    ],
    defaultParams: [],
    version: '1.0'
  });

  addFuncDef({
    name: 'mapSeries',
    shortName: 'map',
    params: [{ name: "node", type: 'int' }],
    defaultParams: [3],
    category: categories.Combine,
    version: '1.0'
  });

  addFuncDef({
    name: 'movingMin',
    category: categories.Calculate,
    params: [{ name: 'windowSize', type: 'int_or_interval', options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: [10],
    version: '1.0'
  });

  addFuncDef({
    name: 'movingMax',
    category: categories.Calculate,
    params: [{ name: 'windowSize', type: 'int_or_interval', options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: [10],
    version: '1.0'
  });

  addFuncDef({
    name: 'movingSum',
    category: categories.Calculate,
    params: [{ name: 'windowSize', type: 'int_or_interval', options: ['5', '7', '10', '5min', '10min', '30min', '1hour'] }],
    defaultParams: [10],
    version: '1.0'
  });

  addFuncDef({
    name: "multiplySeriesWithWildcards",
    category: categories.Calculate,
    params: [
      { name: "position", type: "int", options: [0,1,2,3,4,5,6,7,8,9,10,12] },
      { name: "position", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "position", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
      { name: "position", type: "int", options: [0,-1,-2,-3,-4,-5,-6,-7], optional: true },
    ],
    defaultParams: [2],
    version: '1.0'
  });

  addFuncDef({
    name: 'offsetToZero',
    category: categories.Transform,
    version: '1.0'
  });

  addFuncDef({
    name: 'pow',
    category: categories.Transform,
    params: [{ name: 'factor', type: 'int' }],
    defaultParams: [10],
    version: '1.0'
  });

  addFuncDef({
    name: 'powSeries',
    category: categories.Transform,
    params: optionalSeriesRefArgs,
    defaultParams: [''],
    version: '1.0'
  });

  addFuncDef({
    name: 'reduceSeries',
    shortName: 'reduce',
    params: [
      { name: "function", type: 'string', options: ['asPercent', 'diffSeries', 'divideSeries'] },
      { name: "reduceNode", type: 'int', options: [0,1,2,3,4,5,6,7,8,9,10,11,12,13] },
      { name: "reduceMatchers", type: 'string' },
      { name: "reduceMatchers", type: 'string' },
    ],
    defaultParams: ['asPercent', 2, 'used_bytes', 'total_bytes'],
    category: categories.Combine,
    version: '1.0'
  });

  addFuncDef({
    name: 'removeBetweenPercentile',
    category: categories.Filter,
    params: [{ name: "n", type: "int", }],
    defaultParams: [95],
    version: '1.0'
  });

  addFuncDef({
    name: 'removeEmptySeries',
    category: categories.Filter,
    version: '1.0'
  });

  addFuncDef({
    name: 'squareRoot',
    category: categories.Transform,
    version: '1.0'
  });

  addFuncDef({
    name: 'timeSlice',
    category: categories.Transform,
    params: [
      { name: "startSliceAt", type: "select", options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d']},
      { name: "endSliceAt", type: "select", options: ['-1h', '-6h', '-12h', '-1d', '-2d', '-7d', '-14d', '-30d'], optional: true }
    ],
    defaultParams: ['-1h'],
    version: '1.0'
  });

  addFuncDef({
    name: 'weightedAverage',
    category: categories.Filter,
    params: [
      { name: 'other', type: 'value_or_series', optional: true },
      { name: "node", type: "int", options: [0,1,2,3,4,5,6,7,8,9,10,12] },
    ],
    defaultParams: ['#A', 4],
    version: '1.0'
  });

  _.each(categories, function(funcList, catName) {
    categories[catName] = _.sortBy(funcList, 'name');
  });

  function FuncInstance(funcDef, options) {
    this.def = funcDef;
    this.params = [];

    if (options && options.withDefaultParams) {
      this.params = funcDef.defaultParams.slice(0);
    }

    this.updateText();
  }

  FuncInstance.prototype.render = function(metricExp) {
    var str = this.def.name + '(';
    var parameters = _.map(this.params, function(value, index) {

      var paramType = this.def.params[index].type;
      if (paramType === 'int' || paramType === 'value_or_series' || paramType === 'boolean') {
        return value;
      }
      else if (paramType === 'int_or_interval' && $.isNumeric(value)) {
        return value;
      }

      return "'" + value + "'";

    }.bind(this));

    if (metricExp) {
      parameters.unshift(metricExp);
    }

    return str + parameters.join(', ') + ')';
  };

  FuncInstance.prototype._hasMultipleParamsInString = function(strValue, index) {
    if (strValue.indexOf(',') === -1) {
      return false;
    }

    return this.def.params[index + 1] && this.def.params[index + 1].optional;
  };

  FuncInstance.prototype.updateParam = function(strValue, index) {
    // handle optional parameters
    // if string contains ',' and next param is optional, split and update both
    if (this._hasMultipleParamsInString(strValue, index)) {
      _.each(strValue.split(','), function(partVal, idx) {
        this.updateParam(partVal.trim(), idx);
      }.bind(this));
      return;
    }

    if (strValue === '' && this.def.params[index].optional) {
      this.params.splice(index, 1);
    }
    else {
      this.params[index] = strValue;
    }

    this.updateText();
  };

  FuncInstance.prototype.updateText = function () {
    if (this.params.length === 0) {
      this.text = this.def.name + '()';
      return;
    }

    var text = this.def.name + '(';
    text += this.params.join(', ');
    text += ')';
    this.text = text;
  };

  function isVersionRelatedFunction(func, graphiteVersion) {
    return isVersionGreaterOrEqual(graphiteVersion, func.version) || !func.version;
  }

  function isVersionGreaterOrEqual(a, b) {
    var a_num = Number(a);
    var b_num = Number(b);
    return a_num >= b_num;
  }

  return {
    createFuncInstance: function(funcDef, options) {
      if (_.isString(funcDef)) {
        if (!index[funcDef]) {
          throw { message: 'Method not found ' + name };
        }
        funcDef = index[funcDef];
      }
      return new FuncInstance(funcDef, options);
    },

    getFuncDef: function(name) {
      return index[name];
    },

    getCategories: function(graphiteVersion) {
      var filteredCategories = {};
      _.each(categories, function(functions, category) {
        var filteredFuncs = _.filter(functions, function(func) {
          return isVersionRelatedFunction(func, graphiteVersion);
        });
        if (filteredFuncs.length) {
          filteredCategories[category] = filteredFuncs;
        }
      });

      return filteredCategories;
    }
  };

});
