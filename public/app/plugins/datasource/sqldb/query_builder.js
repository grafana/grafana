define([
  'lodash'
],
function (_) {
  'use strict';

  function SqlQueryBuilder(target) {
    this.target = target;
  }

  function renderTagCondition (tag, index) {
    var str = "";
    var operator = tag.operator;
    var value = tag.value;
    if (index > 0) {
      str = (tag.condition || 'AND') + ' ';
    }

    // quote value unless regex or number
    if (isNaN(+value)) {
      value = "'" + value + "'";
    }

    return str + '"' + tag.key + '" ' + operator + ' ' + value;
  }

  var p = SqlQueryBuilder.prototype;

  p.build = function() {
    return this.target.rawQuery ? this._modifyRawQuery() : this._buildQuery();
  };

  p.buildExploreQuery = function(type, withKey) {
    var query;
    var table;

    if (type === 'TAG_KEYS') {
      query = 'SELECT column_name ' +
              'FROM information_schema.columns ' +
              'WHERE table_schema = \'' + this.target.schema + '\' AND ' +
                    'table_name = \'' + this.target.table + '\' ' +
              'ORDER BY ordinal_position';
      return query;

    } else if (type === 'TAG_VALUES') {
      query = 'SELECT distinct(' + withKey + ') ' +
              'FROM "' + this.target.schema + '"."' + this.target.table + '" ' +
              'ORDER BY ' + withKey;
      return query;

    } else if (type === 'TABLES') {
      query = 'SELECT table_name ' +
              'FROM information_schema.tables ' +
              'WHERE table_schema = \'' + this.target.schema + '\' ' +
              'ORDER BY table_name';
      return query;

    } else if (type === 'FIELDS') {
      query = 'SELECT concat(column_name, \' : \', data_type)' +
              'FROM information_schema.columns ' +
              'WHERE table_schema = \'' + this.target.schema + '\' AND ' +
                    'table_name = \'' + this.target.table + '\' ' +
              'ORDER BY ordinal_position';
      return query;

    } else if (type === 'SCHEMA') {
      query = 'SELECT schema_name ' +
              'FROM information_schema.schemata ' +
              'ORDER BY schema_name';
      return query;

    } else if (type === 'SET_DEFAULT') {
      var exceptSchemaArr = "'information_schema', 'pg_catalog'";
      var numericTypes = "'numeric', 'decimal', 'bigint', 'integer', " +
                         "'double', 'double precision', 'float'";

      query = 'SELECT table_schema, table_name, ' +
                     'concat(column_name, \' : \', data_type) ' +
              'FROM information_schema.columns ' +
              'WHERE table_schema NOT IN (' + exceptSchemaArr + ') ' +
              'ORDER BY (data_type LIKE \'timestamp%\') desc, ' +
                       '(data_type = \'datetime\') desc, ' +
                       'table_schema, table_name, ' +
                       '(data_type IN (' + numericTypes + ')) desc, ' +
                       'ordinal_position ' +
              'LIMIT 1';
      return query;
    }

    if (table) {
      if (!table.match('^/.*/') && !table.match(/^merge\(.*\)/)) {
        table = '"' + table+ '"';
      }
      query += ' FROM ' + table;
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

  return SqlQueryBuilder;
});
