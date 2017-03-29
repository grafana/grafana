define([
  'lodash'
],
function (_) {
  'use strict';

  return {
    metricAggTypes: [
      {text: "Count",   value: 'count', requiresField: false},
      {text: "Average",  value: 'avg', requiresField: true, supportsInlineScript: true, supportsMissing: true},
      {text: "Sum",  value: 'sum', requiresField: true, supportsInlineScript: true, supportsMissing: true},
      {text: "Max",  value: 'max', requiresField: true, supportsInlineScript: true, supportsMissing: true},
      {text: "Min",  value: 'min', requiresField: true, supportsInlineScript: true, supportsMissing: true},
      {text: "Extended Stats",  value: 'extended_stats', requiresField: true, supportsMissing: true, supportsInlineScript: true},
      {text: "Percentiles",  value: 'percentiles', requiresField: true, supportsMissing: true, supportsInlineScript: true},
      {text: "Unique Count", value: "cardinality", requiresField: true, supportsMissing: true},
      {text: "Moving Average",  value: 'moving_avg', requiresField: false, isPipelineAgg: true, minVersion: 2},
      {text: "Derivative",  value: 'derivative', requiresField: false, isPipelineAgg: true, minVersion: 2 },
      {text: "Raw Document", value: "raw_document", requiresField: false}
    ],

    bucketAggTypes: [
      {text: "Terms",           value: 'terms', requiresField: true},
      {text: "Filters",         value: 'filters' },
      {text: "Geo Hash Grid",   value: 'geohash_grid', requiresField: true},
      {text: "Date Histogram",  value: 'date_histogram', requiresField: true},
      {text: "Histogram",       value: 'histogram', requiresField: true},
    ],

    orderByOptions: [
      {text: "Doc Count",  value: '_count' },
      {text: "Term value", value: '_term' },
    ],

    orderOptions: [
      {text: "Top",     value: 'desc' },
      {text: "Bottom",  value: 'asc' },
    ],

    sizeOptions: [
      {text: "No limit", value: '0' },
      {text: "1", value: '1' },
      {text: "2", value: '2' },
      {text: "3", value: '3' },
      {text: "5", value: '5' },
      {text: "10", value: '10' },
      {text: "15", value: '15' },
      {text: "20", value: '20' },
    ],

    extendedStats: [
      {text: 'Avg', value: 'avg'},
      {text: 'Min', value: 'min'},
      {text: 'Max', value: 'max'},
      {text: 'Sum', value: 'sum'},
      {text: 'Count', value: 'count'},
      {text: 'Std Dev', value: 'std_deviation'},
      {text: 'Std Dev Upper', value: 'std_deviation_bounds_upper'},
      {text: 'Std Dev Lower', value: 'std_deviation_bounds_lower'},
    ],

    intervalOptions: [
      {text: 'auto', value: 'auto'},
      {text: '10s', value: '10s'},
      {text: '1m', value: '1m'},
      {text: '5m', value: '5m'},
      {text: '10m', value: '10m'},
      {text: '20m', value: '20m'},
      {text: '1h', value: '1h'},
      {text: '1d', value: '1d'},
    ],

    movingAvgModelOptions: [
      {text: 'Simple', value: 'simple'},
      {text: 'Linear', value: 'linear'},
      {text: 'Exponentially Weighted', value: 'ewma'},
      {text: 'Holt Linear', value: 'holt'},
      {text: 'Holt Winters', value: 'holt_winters'},
    ],

    pipelineOptions: {
      'moving_avg' : [
        {text: 'window', default: 5},
        {text: 'model', default: 'simple'},
        {text: 'predict', default: undefined},
        {text: 'minimize', default: false},
      ],
      'derivative': [
        {text: 'unit', default: undefined},
      ]
    },

    movingAvgModelSettings: {
      'simple' : [],
      'linear' : [],
      'ewma' : [
        {text: "Alpha", value: "alpha", default: undefined}],
      'holt' : [
        {text: "Alpha", value: "alpha",  default: undefined},
        {text: "Beta", value: "beta",  default: undefined},
       ],
      'holt_winters' : [
        {text: "Alpha", value: "alpha", default: undefined},
        {text: "Beta", value: "beta", default: undefined},
        {text: "Gamma", value: "gamma", default: undefined},
        {text: "Period", value: "period", default: undefined},
        {text: "Pad", value: "pad", default: undefined, isCheckbox: true},
       ],
    },

    getMetricAggTypes: function(esVersion) {
      return _.filter(this.metricAggTypes, function(f) {
        if (f.minVersion) {
          return f.minVersion <= esVersion;
        } else {
          return true;
        }
      });
    },

    getPipelineOptions: function(metric) {
      if (!this.isPipelineAgg(metric.type)) {
        return [];
      }

      return this.pipelineOptions[metric.type];
    },

    isPipelineAgg: function(metricType) {
      if (metricType) {
        var po = this.pipelineOptions[metricType];
        return po !== null && po !== undefined;
      }

      return false;
    },

    getPipelineAggOptions: function(targets) {
      var self = this;
      var result = [];
      _.each(targets.metrics, function(metric) {
        if (!self.isPipelineAgg(metric.type)) {
          result.push({text: self.describeMetric(metric), value: metric.id });
        }
      });

      return result;
    },

    getMovingAvgSettings: function(model, filtered) {
      var filteredResult = [];
      if (filtered) {
        _.each(this.movingAvgModelSettings[model], function(setting) {
          if (!(setting.isCheckbox)) {
            filteredResult.push(setting);
          }
        });
        return filteredResult;
      }
      return this.movingAvgModelSettings[model];
    },

    getOrderByOptions: function(target) {
      var self = this;
      var metricRefs = [];
      _.each(target.metrics, function(metric) {
        if (metric.type !== 'count') {
          metricRefs.push({text: self.describeMetric(metric), value: metric.id});
        }
      });

      return this.orderByOptions.concat(metricRefs);
    },

    describeOrder: function(order) {
      var def = _.find(this.orderOptions, {value: order});
      return def.text;
    },

    describeMetric: function(metric) {
      var def = _.find(this.metricAggTypes, {value: metric.type});
      return def.text + ' ' + metric.field;
    },

    describeOrderBy: function(orderBy, target) {
      var def = _.find(this.orderByOptions, {value: orderBy});
      if (def) {
        return def.text;
      }
      var metric = _.find(target.metrics, {id: orderBy});
      if (metric) {
        return this.describeMetric(metric);
      } else {
        return "metric not found";
      }
    },
  };

});
