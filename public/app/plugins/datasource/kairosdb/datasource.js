define([
  'angular',
  'lodash',
  'kbn',
  './queryCtrl',
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('KairosDBDatasource', function($q, $http, templateSrv) {

    function KairosDBDatasource(datasource) {
      this.type = datasource.type;
      this.editorSrc = 'plugins/datasources/kairosdb/kairosdb.editor.html';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
    }

    // Called once per panel (graph)
    KairosDBDatasource.prototype.query = function(options) {
      var start = options.range.from;
      var end = options.range.to;

      var queries = _.compact(_.map(options.targets, _.partial(convertTargetToQuery, options)));
      var plotParams = _.compact(_.map(options.targets, function(target) {
        var alias = target.alias;
        if (typeof target.alias === 'undefined' || target.alias === "") {
          alias = target.metric;
        }

        if (!target.hide) {
          return { alias: alias, exouter: target.exOuter };
        }
        else {
          return null;
        }
      }));

      var handleKairosDBQueryResponseAlias = _.partial(handleKairosDBQueryResponse, plotParams);

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      return this.performTimeSeriesQuery(queries, start, end).then(handleKairosDBQueryResponseAlias, handleQueryError);
    };

    ///////////////////////////////////////////////////////////////////////
    /// Query methods
    ///////////////////////////////////////////////////////////////////////

    KairosDBDatasource.prototype.performTimeSeriesQuery = function(queries, start, end) {
      var reqBody = {
        metrics: queries,
        cache_time: 0
      };

      convertToKairosTime(start, reqBody, 'start');
      convertToKairosTime(end, reqBody, 'end');

      var options = {
        method: 'POST',
        url: this.url + '/api/v1/datapoints/query',
        data: reqBody
      };

      return $http(options);
    };

    /**
     * Gets the list of metrics
     * @returns {*|Promise}
     */
    KairosDBDatasource.prototype.performMetricSuggestQuery = function() {
      var options = {
        url : this.url + '/api/v1/metricnames',
        method : 'GET'
      };

      return $http(options).then(function(response) {
        if (!response.data) {
          return [];
        }
        return response.data.results;
      });
    };

    KairosDBDatasource.prototype.performTagSuggestQuery = function(metricname) {
      var options = {
        url : this.url + '/api/v1/datapoints/query/tags',
        method : 'POST',
        data : {
          metrics : [{ name : metricname }],
          cache_time : 0,
          start_absolute: 0
        }
      };

      return $http(options).then(function(response) {
        if (!response.data) {
          return [];
        }
        else {
          return response.data.queries[0].results[0];
        }
      });
    };

    KairosDBDatasource.prototype.metricFindQuery = function(query) {
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      return this.performMetricSuggestQuery().then(function(metrics) {
        return _.chain(metrics)
          .filter(function(metric) {
            return metric.indexOf(interpolated) >= 0;
          })
          .map(function(metric) {
            return {
              text: metric,
              expandable: true
            };
          })
          .value();
      });
    };

    /////////////////////////////////////////////////////////////////////////
    /// Formatting methods
    ////////////////////////////////////////////////////////////////////////

    /**
     * Requires a verion of KairosDB with every CORS defects fixed
     * @param results
     * @returns {*}
     */
    function handleQueryError(results) {
      if (results.data.errors && !_.isEmpty(results.data.errors)) {
        var errors = {
          message: results.data.errors[0]
        };
        return $q.reject(errors);
      }
      else {
        return $q.reject(results);
      }
    }

    function handleKairosDBQueryResponse(plotParams, results) {
      var output = [];
      var index = 0;
      _.each(results.data.queries, function(series) {
        _.each(series.results, function(result) {
          var target = plotParams[index].alias;
          var details = " ( ";

          _.each(result.group_by, function(element) {
            if (element.name === "tag") {
              _.each(element.group, function(value, key) {
                details += key + "=" + value + " ";
              });
            }
            else if (element.name === "value") {
              details += 'value_group=' + element.group.group_number + " ";
            }
            else if (element.name === "time") {
              details += 'time_group=' + element.group.group_number + " ";
            }
          });

          details += ") ";

          if (details !== " ( ) ") {
            target += details;
          }

          var datapoints = [];

          for (var i = 0; i < result.values.length; i++) {
            var t = Math.floor(result.values[i][0]);
            var v = result.values[i][1];
            datapoints[i] = [v, t];
          }
          if (plotParams[index].exouter) {
            datapoints = new PeakFilter(datapoints, 10);
          }
          output.push({ target: target, datapoints: datapoints });
        });

        index++;
      });

      return { data: _.flatten(output) };
    }

    function convertTargetToQuery(options, target) {
      if (!target.metric || target.hide) {
        return null;
      }

      var query = {
        name: templateSrv.replace(target.metric)
      };

      query.aggregators = [];

      if (target.downsampling !== '(NONE)') {
        query.aggregators.push({
          name: target.downsampling,
          align_sampling: true,
          align_start_time: true,
          sampling: KairosDBDatasource.prototype.convertToKairosInterval(target.sampling || options.interval)
        });
      }

      if (target.horizontalAggregators) {
        _.each(target.horizontalAggregators, function(chosenAggregator) {
          var returnedAggregator = {
            name:chosenAggregator.name
          };

          if (chosenAggregator.sampling_rate) {
            returnedAggregator.sampling = KairosDBDatasource.prototype.convertToKairosInterval(chosenAggregator.sampling_rate);
            returnedAggregator.align_sampling = true;
            returnedAggregator.align_start_time =true;
          }

          if (chosenAggregator.unit) {
            returnedAggregator.unit = chosenAggregator.unit + 's';
          }

          if (chosenAggregator.factor && chosenAggregator.name === 'div') {
            returnedAggregator.divisor = chosenAggregator.factor;
          }
          else if (chosenAggregator.factor && chosenAggregator.name === 'scale') {
            returnedAggregator.factor = chosenAggregator.factor;
          }

          if (chosenAggregator.percentile) {
            returnedAggregator.percentile = chosenAggregator.percentile;
          }
          query.aggregators.push(returnedAggregator);
        });
      }

      if (_.isEmpty(query.aggregators)) {
        delete query.aggregators;
      }

      if (target.tags) {
        query.tags = angular.copy(target.tags);
        _.forOwn(query.tags, function(value, key) {
          query.tags[key] = _.map(value, function(tag) { return templateSrv.replace(tag); });
        });
      }

      if (target.groupByTags || target.nonTagGroupBys) {
        query.group_by = [];
        if (target.groupByTags) {
          query.group_by.push({
            name: "tag",
            tags: _.map(angular.copy(target.groupByTags), function(tag) { return templateSrv.replace(tag); })
          });
        }

        if (target.nonTagGroupBys) {
          _.each(target.nonTagGroupBys, function(rawGroupBy) {
            var formattedGroupBy = angular.copy(rawGroupBy);
            if (formattedGroupBy.name === 'time') {
              formattedGroupBy.range_size = KairosDBDatasource.prototype.convertToKairosInterval(formattedGroupBy.range_size);
            }
            query.group_by.push(formattedGroupBy);
          });
        }
      }
      return query;
    }

    ///////////////////////////////////////////////////////////////////////
    /// Time conversion functions specifics to KairosDB
    //////////////////////////////////////////////////////////////////////

    KairosDBDatasource.prototype.convertToKairosInterval = function(intervalString) {
      intervalString = templateSrv.replace(intervalString);

      var interval_regex = /(\d+(?:\.\d+)?)([Mwdhmsy])/;
      var interval_regex_ms = /(\d+(?:\.\d+)?)(ms)/;
      var matches = intervalString.match(interval_regex_ms);
      if (!matches) {
        matches = intervalString.match(interval_regex);
      }
      if (!matches) {
        throw new Error('Invalid interval string, expecting a number followed by one of "y M w d h m s ms"');
      }

      var value = matches[1];
      var unit = matches[2];
      if (value%1 !== 0) {
        if (unit === 'ms') {
          throw new Error('Invalid interval value, cannot be smaller than the millisecond');
        }
        value = Math.round(kbn.intervals_in_seconds[unit] * value * 1000);
        unit = 'ms';
      }

      return {
        value: value,
        unit: convertToKairosDBTimeUnit(unit)
      };
    };

    function convertToKairosTime(date, response_obj, start_stop_name) {
      var name;

      if (_.isString(date)) {
        if (date === 'now') {
          return;
        }
        else if (date.indexOf('now-') >= 0) {
          date = date.substring(4);
          name = start_stop_name + "_relative";
          var re_date = /(\d+)\s*(\D+)/;
          var result = re_date.exec(date);

          if (result) {
            var value = result[1];
            var unit = result[2];

            response_obj[name] = {
              value: value,
              unit: convertToKairosDBTimeUnit(unit)
            };
            return;
          }
          console.log("Unparseable date", date);
          return;
        }

        date = kbn.parseDate(date);
      }

      if (_.isDate(date)) {
        name = start_stop_name + "_absolute";
        response_obj[name] = date.getTime();
        return;
      }

      console.log("Date is neither string nor date");
    }

    function convertToKairosDBTimeUnit(unit) {
      switch (unit) {
      case 'ms':
        return 'milliseconds';
      case 's':
        return 'seconds';
      case 'm':
        return 'minutes';
      case 'h':
        return 'hours';
      case 'd':
        return 'days';
      case 'w':
        return 'weeks';
      case 'M':
        return 'months';
      case 'y':
        return 'years';
      default:
        console.log("Unknown unit ", unit);
        return '';
      }
    }

    function PeakFilter(dataIn, limit) {
      var datapoints = dataIn;
      var arrLength = datapoints.length;
      if (arrLength <= 3) {
        return datapoints;
      }
      var LastIndx = arrLength - 1;

      // Check first point
      var prvDelta = Math.abs((datapoints[1][0] - datapoints[0][0]) / datapoints[0][0]);
      var nxtDelta = Math.abs((datapoints[1][0] - datapoints[2][0]) / datapoints[2][0]);
      if (prvDelta >= limit && nxtDelta < limit) {
        datapoints[0][0] = datapoints[1][0];
      }

      // Check last point
      prvDelta = Math.abs((datapoints[LastIndx - 1][0] - datapoints[LastIndx - 2][0]) / datapoints[LastIndx - 2][0]);
      nxtDelta = Math.abs((datapoints[LastIndx - 1][0] - datapoints[LastIndx][0]) / datapoints[LastIndx][0]);
      if (prvDelta >= limit && nxtDelta < limit) {
        datapoints[LastIndx][0] = datapoints[LastIndx - 1][0];
      }

      for (var i = 1; i < arrLength - 1; i++) {
        prvDelta = Math.abs((datapoints[i][0] - datapoints[i - 1][0]) / datapoints[i - 1][0]);
        nxtDelta = Math.abs((datapoints[i][0] - datapoints[i + 1][0]) / datapoints[i + 1][0]);
        if (prvDelta >= limit && nxtDelta >= limit) {
          datapoints[i][0] = (datapoints[i - 1][0] + datapoints[i + 1][0]) / 2;
        }
      }

      return datapoints;
    }

    return KairosDBDatasource;
  });

});
