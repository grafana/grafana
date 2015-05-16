define([
  'lodash'
],
function (_) {
  'use strict';

  function InfluxQueryBuilder(target) {
    this.target = target;
  }

  var p = InfluxQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p.showTagsQuery = function() {
    var query = 'SHOW TAG KEYS';

    if (this.target.measurement) {
      query += ' FROM "' + this.target.measurement + '"';
    }

    return query;
  };

  p._buildQuery = function() {
    var target = this.target;

    console.log('Build Query: target = ', target);

    if (!target.measurement) {
      throw "Metric measurement is missing";
    }

    var query = 'SELECT ';
    var measurement = target.measurement;
    var aggregationFunc = target.function || 'mean';

    if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
      measurement = '"' + measurement+ '"';
    }

    query +=  aggregationFunc + '(value)';
    query += ' FROM ' + measurement + ' WHERE ';
    var conditions = _.map(target.tags, function(tag) {
      return tag.key + '=' + "'" + tag.value + "' ";
    });
    conditions.push('$timeFilter');

    query += conditions.join('AND ');

    query += ' GROUP BY time($interval)';
    if  (target.groupByTags && target.groupByTags.length > 0) {
      query += ', ' + target.groupByTags.join();
    }

    if (target.fill) {
      query += ' fill(' + target.fill + ')';
    }

    query += " ORDER BY asc";
    target.query = query;

    return query;
  };

  p._modifyRawQuery = function () {
    var query = this.target.query.replace(";", "");
    return query;
  };

  return InfluxQueryBuilder;
});
