///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export default class ResponseParser {

  parse(query, results) {
    if (!results || results.results.length === 0) { return []; }

    var influxResults = results.results[0];
    if (!influxResults.series) {
      return [];
    }

    var series = influxResults.series[0];
    return _.map(series.values, (value) => {
      if (_.isArray(value)) {
        if (query.toLowerCase().indexOf('show tag values') >= 0) {
          return { text: (value[1] || value[0]) };
        } else {
          return { text: value[0] };
        }
      } else {
        return { text: value };
      }
    });
  }
}
