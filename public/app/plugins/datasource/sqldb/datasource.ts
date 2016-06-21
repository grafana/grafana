///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import * as dateMath from 'app/core/utils/datemath';
import SqlSeries from './sql_series';
import SqlQuery from './sql_query';
import ResponseParser from './response_parser';
import SqlQueryBuilder from './query_builder';

export default class SqlDatasource {
  type: string;
  username: string;
  password: string;
  name: string;
  database: any;
  interval: any;
  supportAnnotations: boolean;
  supportMetrics: boolean;
  responseParser: any;
  url: string;
  dbms: string;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv) {
    this.type = 'sqldb';

    this.username = instanceSettings.username;
    this.password = instanceSettings.password;
    this.name = instanceSettings.name;
    this.database = instanceSettings.database;
    this.interval = (instanceSettings.jsonData || {}).timeInterval;
    this.supportAnnotations = true;
    this.supportMetrics = true;
    this.responseParser = new ResponseParser();
    this.url = instanceSettings.url;
    this.dbms = (instanceSettings.jsonData || {}).dbms;
  }

  query(options) {
    var queryTargets = [];
    var i, y;

    var allQueries = _.map(options.targets, (target) => {
      if (target.hide) { return []; }
      if (target.timeColDataType === undefined) { return []; }

      queryTargets.push(target);
      var arr = target.timeColDataType.split(':');
      target.timeCol = arr[0].trim();
      target.timeDataType = arr[1].trim();

      var queryModel = new SqlQuery(target, this.templateSrv, options.scopedVars);
      queryModel.dbms = this.dbms;
      var query =  queryModel.render(true);
      query = this._replaceQueryVars(query, options, target);

      return query;

    }).join(";");

    allQueries = this.templateSrv.replace(allQueries, options.scopedVars);

    return this._seriesQuery(allQueries).then((data): any => {
      if (!data || !data.results) {
        return [];
      }

      var seriesList = [];
      for (i = 0; i < data.results.length; i++) {
        var result = data.results[i];
        if (!result || !result.series) { continue; }

        var target = queryTargets[i];
        var alias = target.alias;
        if (alias) {
          alias = this.templateSrv.replace(target.alias, options.scopedVars);
        }

        var sqlSeries = new SqlSeries({ series: data.results[i].series, table: target.table, alias: alias });

        switch (target.resultFormat) {
          case 'table': {
            seriesList.push(sqlSeries.getTable());
            break;
          }
          default: {
            var timeSeries = sqlSeries.getTimeSeries();
            for (y = 0; y < timeSeries.length; y++) {
              seriesList.push(timeSeries[y]);
            }
            break;
          }
        }
      }

      return { data: seriesList };
    });
  };

  annotationQuery(options) {
    var timeDataType = options.annotation.timeDataType;

    if (!options.annotation.query || options.annotation.query === '') {
      var castTimeCol = '';
      if (this._abstractDataType(timeDataType) === 'timestamp') {
        castTimeCol = this._ts2Num('$timeColumn', timeDataType);
      } else {
        castTimeCol = '$timeColumn';
      }
      castTimeCol += ' * 1000';

      options.annotation.query =
          'SELECT ' +
          castTimeCol + ' AS "time", ' +
          (options.annotation.tags || 'NULL') + ' AS "tags", ' +
          (options.annotation.title || 'NULL') + ' AS "title", ' +
          (options.annotation.text || 'NULL') + ' AS "text" ' +
          'FROM ' + options.annotation.schema + '.' + options.annotation.table + ' ' +
          'WHERE $timeFilter';
    }

    var query = options.annotation.query;

    query = this._replaceQueryVars(query, options, options.annotation);
    query = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(query).then(data => {
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from SqlDB' };
      }
      return new SqlSeries({series: data.results[0].series, annotation: options.annotation}).getAnnotations();
    });
  };

  metricFindQuery(query) {
    var interpolated;
    try {
      interpolated = this.templateSrv.replace(query, null, 'regex');
    } catch (err) {
      return this.$q.reject(err);
    }

    return this._seriesQuery(interpolated)
      .then(_.curry(this.responseParser.parse)(query));
  };

  _seriesQuery(query) {
    return this._sqlRequest('POST', '/query', {query: query, epoch: 'ms'});
  }


  serializeParams(params) {
    if (!params) { return '';}

    return _.reduce(params, (memo, value, key) => {
      if (value === null || value === undefined) { return memo; }
      memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      return memo;
    }, []).join("&");
  }

  testDatasource() {
    return this.metricFindQuery('SELECT 1 AS num').then(() => {
      return { status: "success", message: "Data source is working", title: "Success" };
    });
  }

  _sqlRequest(method, url, data) {
    var self = this;

    var options: any = {
      method: method,
      url:    this.url + url,
      data:   data,
      precision: "ms",
      inspect: { type: 'sqldb' },
      paramSerializer: this.serializeParams,
    };

    return this.backendSrv.datasourceRequest(options).then(result => {
      return result.data;
    }, function(err) {
      if (err.status !== 0 || err.status >= 300) {
        if (err.data && err.data.error) {
          throw { message: 'SqlDB Error Response: ' + err.data.error, data: err.data, config: err.config };
        } else {
          throw { message: 'SqlDB Error: ' + err.message, data: err.data, config: err.config };
        }
      }
    });
  };

  _replaceQueryVars(query, options, target) {
      var from = this._getSubTimestamp(options.rangeRaw.from, target.timeDataType, false);
      var to = this._getSubTimestamp(options.rangeRaw.to, target.timeDataType, true);
      var isToNow = (options.rangeRaw.to === 'now');

      var timeFilter = this._getTimeFilter(isToNow);
      query = query.replace(/\$timeFilter/g, timeFilter);

      query = query.replace(/\$from/g, from);
      query = query.replace(/\$to/g, to);

      from = this._getSubTimestamp(options.rangeRaw.from, 'numeric', false);
      to = this._getSubTimestamp(options.rangeRaw.to, 'numeric', true);
      query = query.replace(/\$unixFrom/g, from);
      query = query.replace(/\$unixTo/g, to);

      from = this._getSubTimestamp(options.rangeRaw.from, 'timestamp with time zone', false);
      to = this._getSubTimestamp(options.rangeRaw.to, 'timestamp with time zone', true);
      query = query.replace(/\$timeFrom/g, from);
      query = query.replace(/\$timeTo/g, to);

      var unixtimeColumn = this._getRoundUnixTime(target);
      query = query.replace(/\$unixtimeColumn/g, unixtimeColumn);

      query = query.replace(/\$timeColumn/g, target.timeCol);

      var autoIntervalNum = this._getIntervalNum(target.interval || options.interval);
      query = query.replace(/\$interval/g, autoIntervalNum);

      return query;
  }

  _getTimeFilter(isToNow) {
    if (isToNow) {
      return '$timeColumn > $from';

    } else {
      return '$timeColumn > $from AND $timeColumn < $to';
    }
  }

  _getSubTimestamp(date, toDataType, roundUp) {
    var rtn = null;

    if (_.isString(date)) {
      if (date === 'now') {
        switch (this._abstractDataType(toDataType)) {
        case 'timestamp':
          return this._num2Ts('now()');

        case 'numeric':
          return this._ts2Num('now()', 'timestamp with time zone');
        }
      }

      var parts = /^now-(\d+)([d|h|m|s])$/.exec(date);

      if (parts) {
        var amount = parseInt(parts[1]);
        var unit = parts[2];

        switch (this.dbms) {
        case 'postgres':
          rtn = '(now() - \'' + amount + unit + '\'::interval)';
          break;

        case "mysql":
          var units = {
            'd': 'DAY',
            'h': 'HOUR',
            'm': 'MINUTE',
            's': 'SECOND',
            'w': 'WEEK',
          };
          rtn = 'DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL ' + amount + ' ' + units[unit] + ')';
          break;

        default:
          break;
        }

      } else {
        date = dateMath.parse(date, roundUp);
      }
    }

    var isNumericDate = false;
    if (rtn == null) {
      rtn = (date.valueOf() / 1000).toFixed(0);
      isNumericDate = true;
    }

    switch (this._abstractDataType(toDataType)) {
    case 'timestamp':
      if (isNumericDate) {
        rtn = this._num2Ts(rtn);
      }
      break;

    case 'numeric':
      if (! isNumericDate) {
        rtn = this._ts2Num(rtn, 'timestamp with time zone');
      }
      break;
    }

    return rtn;
  }

  _getRoundUnixTime(target) {
    var col = '$timeColumn';

    if (this._abstractDataType(target.timeDataType) === 'timestamp') {
       col = this._ts2Num(col, 'timestamp with time zone');
    }

    var rtn = col;
    if (target.groupBy && target.groupBy.length > 0) {
      var interval = this._getIntervalNum(target.groupBy[0].params[0]);
      switch (this.dbms) {
      case "postgres":
        rtn = 'round(' + col + ' / ' + interval + ') * ' + interval;
        break;

      case "mysql":
        rtn = '(' + col + ' DIV ' + interval + ') * ' + interval;
        break;
      }
    }

    return rtn;
  }

  _num2Ts(str) {
    if (str === 'now()') {
      return str;

    } else {
      switch (this.dbms) {
      case 'postgres':
        return 'to_timestamp(' + str + ')';

      case 'mysql':
        return 'FROM_UNIXTIME(' + str + ')';

      default:
        return str;
      }
    }
  }

  _ts2Num(str, toDataType) {
    switch (this.dbms) {
    case 'postgres':
      return 'extract(epoch from ' + str + '::' + this._pgShortTs(toDataType) + ')';

    case 'mysql':
      return 'UNIX_TIMESTAMP(' + str + ')';

    default:
      return str;
    }
  }

  _getIntervalNum(str) {
    var rtn = str;

    if (str === 'auto') {
      return '$interval';
    }

    var parts = /^(\d+)([a-z]*)$/.exec(str);
    if (parts) {
      var amount = parseInt(parts[1]);
      var unit = parts[2];

      // cast to seconds
      switch (unit) {
        case 'ms':
          rtn = amount / 1000;
          break;

        case 'm':
          rtn = amount * 60;
          break;

        case 'h':
          rtn = amount * 60 * 12;
          break;

        case 'd':
          rtn = amount * 60 * 12 * 24;
          break;

        case 'w':
          rtn = amount * 60 * 12 * 24 * 7;
          break;

        default: // "s"
          rtn = amount;
      }
    }

    return rtn;
  }

  _abstractDataType(datatype) {
    switch (datatype) {
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'timestamp':
    case 'timestamptz':
    case 'datetime':
    case 'date':
      return 'timestamp';

    case 'numeric':
    case 'decimal':
    case 'bigint':
    case 'integer':
    case 'real':
    case 'float':
    case 'double':
    case 'double precision':
      return 'numeric';

    default:
      return datatype;
    }
  }

  _pgShortTs(str) {
    switch (str) {
    case 'timestamptz':
    case 'timestamp with time zone':
      return 'timestamptz';

    case 'timestamp':
    case 'timestamp without time zone':
      return 'timestamp';

    default:
      return str;
    };
  }
}
