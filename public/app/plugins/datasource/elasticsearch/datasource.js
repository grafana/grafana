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

  module.factory('ElasticDatasource', function($q, backendSrv, templateSrv, timeSrv) {

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

      var processTimeSeries = _.bind(this._processTimeSeries, this, sentTargets);
      return this._post('/_msearch?search_type=count', payload).then(processTimeSeries);
    };

    ElasticDatasource.prototype.translateTime = function(date) {
      if (_.isString(date)) {
        return date;
      }

      return date.getTime();
    };

    ElasticDatasource.prototype._processBuckets = function(buckets, groupByFields, series, level, parentName, parentTime) {
      var points = [];
      var groupBy = groupByFields[level];

      for (var i = 0; i < buckets.length; i++) {
        var bucket = buckets[i];

        if (groupBy) {
          var seriesName = "";
          var time = parentTime || bucket.key;
          this._processBuckets(bucket[groupBy.field].buckets, groupByFields, series, level+1, seriesName, time)
        } else {
          var seriesName = parentName;

          if (level > 0) {
            seriesName += bucket.key;
          } else {
            parentTime = bucket.key;
          }

          var serie = series[seriesName] = series[seriesName] || {target: seriesName, datapoints: []};
          serie.datapoints.push([bucket.doc_count, parentTime]);
        }
      }
    };

    ElasticDatasource.prototype._processTimeSeries = function(targets, results) {
      var series = [];

      for (var i = 0; i < results.responses.length; i++) {
        var buckets = results.responses[i].aggregations.histogram.buckets;
        var target = targets[i];
        var points = [];
        var querySeries = {}

        this._processBuckets(buckets, target.groupByFields, querySeries, 0, target.refId);

        _.each(querySeries, function(value) {
          series.push(value);
        });
      };

      return { data: series };
    };

    ElasticDatasource.prototype.metricFindQuery = function(query) {
      var timeFrom = this.translateTime(timeSrv.time.from);
      var timeTo = this.translateTime(timeSrv.time.to);

      var query = {
        size: 10,
        "query": {
          "filtered": {
            "filter": {
              "bool": {
                "must": [
                  {
                    "range": {
                      "@timestamp": {
                        "gte": timeFrom,
                        "lte": timeTo
                      }
                    }
                  }
                ],
              }
            }
          }
        }
      };

      return this._post('/_search?', query).then(function(res) {
        var fields = {};

        for (var i = 0; i < res.hits.hits.length; i++) {
          var hit = res.hits.hits[i];
          for (var field in hit) {
            if (hit.hasOwnProperty(field) && field[0] !== '_') {
              fields[field] = 1;
            }
          }

          if (hit._source) {
            for (var field in hit._source) {
              if (hit._source.hasOwnProperty(field)) {
                fields[field] = 1;
              }
            }
          }
        }

        fields = _.map(_.keys(fields), function(field) {
          return {text: field};
        })
        console.log('metricFindQuery:',  fields);
        return fields;
      });
      // var d = $q.defer();
      //
      // var fieldsQuery = query.match(/^fields\(\)/);
      // if (fieldsQuery) {
      //   return d.promise;
      // }
    };

    return ElasticDatasource;
  });
});
