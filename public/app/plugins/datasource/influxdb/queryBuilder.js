define([
  'lodash'
],
function (_) {
  'use strict';

  function InfluxQueryBuilder(target) {
    this.target = target;
  }

  function renderTagCondition (tag, index) {
    var str = "";
    var operator = tag.operator;
    var value = tag.value;
    if (index > 0) {
      str = (tag.condition || 'AND') + ' ';
    }

    if (!operator) {
      if (/^\/.*\/$/.test(tag.value)) {
        operator = '=~';
      } else {
        operator = '=';
      }
    }

    // quote value unless regex
    if (operator !== '=~' && operator !== '!~') {
      value = "'" + value + "'";
    }

    return str + '"' + tag.key + '" ' + operator + ' ' + value;
  }

  var p = InfluxQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p.buildExploreQuery = function(type, withKey) {
    var query;
    var measurement;

    if (type === 'TAG_KEYS') {
      query = 'SHOW TAG KEYS';
      measurement = this.target.measurement;
    } else if (type === 'TAG_VALUES') {
      query = 'SHOW TAG VALUES';
      measurement = this.target.measurement;
    } else if (type === 'MEASUREMENTS') {
      query = 'SHOW MEASUREMENTS';
    } else if (type === 'FIELDS') {
      query = 'SHOW FIELD KEYS FROM "' + this.target.measurement + '"';
      return query;
    }

    if (measurement) {
      if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
        measurement = '"' + measurement+ '"';
      }
      query += ' FROM ' + measurement;
    }

    if (withKey) {
      query += ' WITH KEY = "' + withKey + '"';
    }

    if (this.target.tags && this.target.tags.length > 0) {
      var whereConditions = _.reduce(this.target.tags, function(memo, tag) {
        // do not add a condition for the key we want to explore for
        if (tag.key === withKey) {
          return memo;
        }
        memo.push(renderTagCondition(tag, memo.length));
        return memo;
      }, []);

      if (whereConditions.length > 0) {
        query +=  ' WHERE ' + whereConditions.join(' ');
      }
    }

    return query;
  };

  p._buildQuery = function() {
    var target = this.target;

    if (!target.measurement) {
      throw "Metric measurement is missing";
    }

    if (!target.fields) {
      target.fields = [{name: 'value', func: target.function || 'mean'}];
    }

    var query = 'SELECT ';
    var i;
    for (i = 0; i < target.fields.length; i++) {
      var field = target.fields[i];
      if (i > 0) {
        query += ', ';
      }
      query += field.func + '("' + field.name + '")';
    }

    var measurement = target.measurement;
    if (!measurement.match('^/.*/') && !measurement.match(/^merge\(.*\)/)) {
      measurement = '"' + measurement+ '"';
    }

    query += ' FROM ' + measurement + ' WHERE ';
    var conditions = _.map(target.tags, function(tag, index) {
      return renderTagCondition(tag, index);
    });

    query += conditions.join(' ');
    query += (conditions.length > 0 ? ' AND ' : '') + '$timeFilter';

    query += ' GROUP BY';
    for (i = 0; i < target.groupBy.length; i++) {
      var group = target.groupBy[i];
      if (group.type === 'time') {
        query += ' time(10s)';
      } else {
        query += ', ' + group.key;
      }
    }

    if (target.fill) {
      query += ' fill(' + target.fill + ')';
    }

    target.query = query;

    return query;
  };

  p._modifyRawQuery = function () {
    var query = this.target.query.replace(";", "");
    return query;
  };

  return InfluxQueryBuilder;
});
