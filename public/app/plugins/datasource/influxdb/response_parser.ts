///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export default class ResponseParser {
    parse(queryType, results) {
      if (!results || results.results.length === 0) { return []; }

      var influxResults = results.results[0];
      if (!influxResults.series) {
        return [];
      }

      var series = influxResults.series[0];
      return _.map(series.values, function(value) {
        if (_.isArray(value)) {
          return { text: value[0] };
        } else {
          return { text: value };
        }
      });
    }
}
