///<reference path="../../headers/common.d.ts" />

import moment = require('moment');
import _ = require('lodash');

export class TableModel {
  columns: any[];
  rows: any[];

  static transform(data, panel) {
    var model = new TableModel();

    if (!data || data.length === 0) {
      return model;
    }

    model.columns = [
      {text: 'Time'},
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

        model.rows.push([time, value]);
      }
    }

    return model;
  }
}


