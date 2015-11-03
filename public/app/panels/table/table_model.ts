///<reference path="../../headers/common.d.ts" />

import moment = require('moment');
import _ = require('lodash');

var transformers = {};

transformers['timeseries_to_rows'] = {
  description: 'Time series to rows',
  transform: function(data, panel, model) {
    model.columns = [
      {text: 'Time'},
      {text: 'Series'},
      {text: 'Value'},
    ];

    model.rows = [];

    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var time = moment(dp[1]).format('LLL');
        var value = dp[0];
        if (value === null) {
          value = 'null';
        } else if (_.isNumber(value)) {
          value = value.toFixed(2);
        }

        model.rows.push([time, series.target, value]);
      }
    }
  },
};

transformers['timeseries_to_columns'] = {
  description: 'Time series to columns',
  transform: function(data, panel, model) {
    model.columns = [{text: 'Time'}];
    model.rows = [];

    var points = {};

    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      model.columns.push({text: series.target});

      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var time = dp[1];
        if (!points[time]) {
          points[time] = {};
          points[time][i] = [dp[0]];
        }
        else {
          points[time][i] = dp[0];
        }
      }
    }

    for (var time in points) {
      var point = points[time];
      var values = [time];

      for (var i = 0; i < data.length; i++) {
        if (point[i] !== undefined) {
          values.push(point[i]);
        }
      }

      model.rows.push(values);
    }
  }
};

export {transformers}

export class TableModel {
  columns: any[];
  rows: any[];

  static transform(data, panel) {
    var model = new TableModel();

    if (!data || data.length === 0) {
      return model;
    }

    var transformer = transformers[panel.transform];
    if (!transformer) {
      throw {message: 'Transformer ' + panel.transformer + ' not found'};
    }

    transformer.transform(data, panel, model);
    return model;
  }
}
