define([
  'lodash'
],
function (_) {
  'use strict';

  return {
    metricAggTypes: [
      {text: "Count",   value: 'count', requiresField: false},
      {text: "Average",  value: 'avg', requiresField: true},
      {text: "Sum",  value: 'sum', requiresField: true},
      {text: "Max",  value: 'max', requiresField: true},
      {text: "Min",  value: 'min', requiresField: true},
      {text: "Extended Stats",  value: 'extended_stats', requiresField: true},
      {text: "Percentiles",  value: 'percentiles', requiresField: true},
      {text: "Moving Average",  value: 'moving_avg', requiresField: false },
      {text: "Derivative",  value: 'derivative', requiresField: false },
      {text: "Unique Count", value: "cardinality", requiresField: true},
      {text: "Raw Document", value: "raw_document", requiresField: false}
    ],

    bucketAggTypes: [
      {text: "Terms",           value: 'terms' },
      {text: "Filters",         value: 'filters' },
      {text: "Date Histogram",  value: 'date_histogram' },
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

    pipelineOptions: {
      'moving_avg' : [
        {text: 'window', default: 5},
        {text: 'model', default: 'simple'}
      ],
      'derivative': []
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
      var def = _.findWhere(this.orderOptions, {value: order});
      return def.text;
    },

    describeMetric: function(metric) {
      var def = _.findWhere(this.metricAggTypes, {value: metric.type});
      return def.text + ' ' + metric.field;
    },

    describeOrderBy: function(orderBy, target) {
      var def = _.findWhere(this.orderByOptions, {value: orderBy});
      if (def) {
        return def.text;
      }
      var metric = _.findWhere(target.metrics, {id: orderBy});
      if (metric) {
        return this.describeMetric(metric);
      } else {
        return "metric not found";
      }
    },
  };

});
