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

    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var time = moment(dp[1]).format('LLL');
        var value = dp[0];
        model.rows.push([time, series.target, value]);
      }
    }
  },
};

transformers['timeseries_to_columns'] = {
  description: 'Time series to columns',
  transform: function(data, panel, model) {
    model.columns.push({text: 'Time'});

    // group by time
    var points = {};

    for (var i = 0; i < data.length; i++) {
      var series = data[i];
      model.columns.push({text: series.target});

      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        var timeKey = dp[1].toString();

        if (!points[timeKey]) {
          points[timeKey] = {time: dp[1]};
          points[timeKey][i] = dp[0];
        }
        else {
          points[timeKey][i] = dp[0];
        }
      }
    }

    for (var time in points) {
      var point = points[time];
      var values = [moment(point.time).format('LLL')];

      for (var i = 0; i < data.length; i++) {
        var value = point[i];
        values.push(value);
      }

      model.rows.push(values);
    }
  }
};

transformers['annotations'] = {
  description: 'Annotations',
};

transformers['json'] = {
  description: 'JSON',
  transform: function(data, panel, model) {
    model.columns.push({text: 'JSON'});
    debugger;

    for (var i = 0; i < data.length; i++) {
      var series = data[i];

      for (var y = 0; y < series.datapoints.length; y++) {
        var dp = series.datapoints[y];
        model.rows.push([JSON.stringify(dp)]);
      }
    }
  }
};

export {transformers}
