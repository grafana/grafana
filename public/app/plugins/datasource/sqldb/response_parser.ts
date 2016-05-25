///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export default class ResponseParser {

  parse(query, results) {
    if (!results || results.results.length === 0) { return []; }

    var sqlResults = results.results[0];
    if (!sqlResults.series) {
      return [];
    }

    var res = {};
    _.each(sqlResults.series, serie => {
      _.each(serie.values, value => {
        if (_.isArray(value)) {
          addUnique(res, value[0]);
        } else {
          addUnique(res, value);
        }
      });
    });

    return _.map(res, value => {
      return { text: value};
    });
  }
}

function addUnique(arr, value) {
  arr[value] = value;
}
