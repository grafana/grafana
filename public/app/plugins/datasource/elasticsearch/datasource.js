define([
  'angular',
  'lodash',
  'config',
  'kbn',
  'moment',
  './queryBuilder',
  './queryCtrl',
  './directives'
],
function (angular, _, config, kbn, moment, ElasticQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ElasticDatasource', function($q, backendSrv, templateSrv) {

    function ElasticDatasource(datasource) {
      this.type = 'elasticsearch';
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.index = datasource.index;
      this.searchMaxResults = config.search.max_results || 20;

      this.saveTemp = _.isUndefined(datasource.save_temp) ? true : datasource.save_temp;
      this.saveTempTTL = _.isUndefined(datasource.save_temp_ttl) ? '30d' : datasource.save_temp_ttl;
    }

    ElasticDatasource.prototype._request = function(method, url, index, data) {
      var options = {
        url: this.url + "/" + index + url,
        method: method,
        data: data
      };

      if (this.basicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    ElasticDatasource.prototype._get = function(url) {
      return this._request('GET', url, this.index)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype._post = function(url, data) {
      return this._request('POST', url, this.index, data)
        .then(function(results) {
          return results.data;
        });
    };

    ElasticDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var range = {};
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      range[timeField]= {
        from: rangeUnparsed.from,
        to: rangeUnparsed.to,
      };

      var queryInterpolated = templateSrv.replace(queryString);
      var filter = { "bool": { "must": [{ "range": range }] } };
      var query = { "bool": { "should": [{ "query_string": { "query": queryInterpolated } }] } };
      var data = {
        "fields": [timeField, "_source"],
        "query" : { "filtered": { "query" : query, "filter": filter } },
        "size": 10000
      };

      return this._request('POST', '/_search', annotation.index, data).then(function(results) {
        var list = [];
        var hits = results.data.hits.hits;

        var getFieldFromSource = function(source, fieldName) {
          if (!fieldName) { return; }

          var fieldNames = fieldName.split('.');
          var fieldValue = source;

          for (var i = 0; i < fieldNames.length; i++) {
            fieldValue = fieldValue[fieldNames[i]];
            if (!fieldValue) {
              console.log('could not find field in annotatation: ', fieldName);
              return '';
            }
          }

          if (_.isArray(fieldValue)) {
            fieldValue = fieldValue.join(', ');
          }
          return fieldValue;
        };

        for (var i = 0; i < hits.length; i++) {
          var source = hits[i]._source;
          var fields = hits[i].fields;
          var time = source[timeField];

          if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
            time = fields[timeField];
          }

          var event = {
            annotation: annotation,
            time: moment.utc(time).valueOf(),
            title: getFieldFromSource(source, titleField),
            tags: getFieldFromSource(source, tagsField),
            text: getFieldFromSource(source, textField)
          };

          list.push(event);
        }
        return list;
      });
    };

    ElasticDatasource.prototype.testDatasource = function() {
      var query = JSON.stringify();
      return this._post('/_search?search_type=count', query).then(function() {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    ElasticDatasource.prototype.query = function(options) {
      var queryBuilder = new ElasticQueryBuilder();
      var header = '{"index":"' + this.index + '","search_type":"count","ignore_unavailable":true}'
      var payload = ""
      var sentTargets = [];
      var timeFrom = this.translateTime(options.range.from);
      var timeTo = this.translateTime(options.range.to);

      _.each(options.targets, function(target) {
        if (target.hide) {
          return;
        }

        var esQuery = queryBuilder.build(target, timeFrom, timeTo);
        payload += header + '\n';
        payload += esQuery + '\n';

        sentTargets.push(target);
      });

      payload = payload.replace(/\$interval/g, options.interval);
      payload = payload.replace(/\$rangeFrom/g, this.translateTime(options.range.from));
      payload = payload.replace(/\$rangeTo/g, this.translateTime(options.range.to));
      payload = payload.replace(/\$maxDataPoints/g, options.maxDataPoints);
      payload = templateSrv.replace(payload, options.scopedVars);

      var processTimeSeries = _.partial(this._processTimeSeries, sentTargets);
      return this._post('/_msearch?search_type=count', payload).then(processTimeSeries);
    };

    ElasticDatasource.prototype.translateTime = function(date) {
      if (_.isString(date)) {
        return date;
      }

      return date.getTime();
    };

    ElasticDatasource._aggToSeries = function(agg) {
      var datapoints = agg.date_histogram.buckets.map(function(entry) {
        return [entry.stats.avg, entry.key];
      });
      return { target: agg.key, datapoints: datapoints };
    };


    ElasticDatasource.prototype._processTimeSeries = function(targets, results) {
      var series = [];

      _.each(results.responses, function(response, index) {
        var buckets = response.aggregations.date_histogram.buckets;
        var target = targets[index];
        var points = [];

        for (var i = 0; i < buckets.length; i++) {
          var bucket = buckets[i];
          points[i] = [bucket.doc_count, bucket.key];
        }

        series.push({target: 'name', datapoints: points})
        console.log('Nr DataPoints: ' + points.length);
      });

      console.log(series);

      return { data: series };
    };

    ElasticDatasource.prototype.metricFindQuery = function(query) {
      var region;
      var namespace;
      var metricName;

      var transformSuggestData = function(suggestData) {
        return _.map(suggestData, function(v) {
          return { text: v };
        });
      };

      var d = $q.defer();

      var regionQuery = query.match(/^region\(\)/);
      if (regionQuery) {
        d.resolve(transformSuggestData(this.performSuggestRegion()));
        return d.promise;
      }
    };

    return ElasticDatasource;
  });
});
