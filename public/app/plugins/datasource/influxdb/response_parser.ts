///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export default class ResponseParser {

  parse(query, results) {
    if (!results || results.results.length === 0) { return []; }

    var influxResults = results.results[0];
    if (!influxResults.series) {
      return [];
    }

    var res = [];
    _.each(influxResults.series, (serie) => {
      _.each(serie.values, (value) => {
        if (_.isArray(value)) {
          if (query.toLowerCase().indexOf('show tag values') >= 0) {
            addUnique(res, { text: (value[1] || value[0])});
          } else {
            addUnique(res, { text: value[0]});
          }
        } else {
          addUnique(res, {text: value});
        }
      });
    });

    return res;
  }
}

function addUnique(arr, value) {
  if (!_.any(arr, value)) {
    arr.push(value);
  }
}
