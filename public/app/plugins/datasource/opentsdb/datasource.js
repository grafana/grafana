define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  'moment',
],
function (angular, _, dateMath) {
  'use strict';

  /** @ngInject */
  function OpenTsDatasource(instanceSettings, $q, backendSrv, templateSrv, contextSrv) {
    this.type = 'opentsdb';
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.withCredentials = instanceSettings.withCredentials;
    this.basicAuth = instanceSettings.basicAuth;
    instanceSettings.jsonData = instanceSettings.jsonData || {};
    this.tsdbVersion = instanceSettings.jsonData.tsdbVersion || 1;
    this.tsdbResolution = instanceSettings.jsonData.tsdbResolution || 1;
    this.supportMetrics = true;
    this.tagKeys = {};
    this.prefix = contextSrv.user.orgId + "." + contextSrv.user.systemId + ".";
    // Called once per panel (graph)
    this.query = function(options) {
      this.prefix = contextSrv.user.orgId + "." + contextSrv.user.systemId + ".";
      var start = convertToTSDBTime(options.rangeRaw.from, false);
      var end = convertToTSDBTime(options.rangeRaw.to, true);
      var qs = [];
      var self = this;

      _.each(options.targets, function(target) {
        if (!target.metric) { return; }
        qs.push(convertTargetToQuery(target, options, self.prefix));
      });

      var queries = _.compact(qs);

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var groupByTags = {};
      _.each(queries, function(query) {
        if (query.filters && query.filters.length > 0) {
          _.each(query.filters, function(val) {
            groupByTags[val.tagk] = true;
          });
        } else {
          _.each(query.tags, function(val, key) {
            groupByTags[key] = true;
          });
        }
      });

      return this.performTimeSeriesQuery(queries, start, end).then(function(response) {
        var metricToTargetMapping = mapMetricsToTargets(response.data, options);
        var result = _.map(response.data, function(metricData, index) {
          index = metricToTargetMapping[index];
          if (index === -1) {
            index = 0;
          }

          this._saveTagKeys(metricData);

          return transformMetricData(metricData, groupByTags, options.targets[index], options, this.tsdbResolution, self.prefix);
        }.bind(this));
        return { data: result };
      }.bind(this));
    };

    this.annotationQuery = function(options) {
      var start = convertToTSDBTime(options.rangeRaw.from, false);
      var end = convertToTSDBTime(options.rangeRaw.to, true);
      var qs = [];
      var eventList = [];

      qs.push({ aggregator:"sum", metric:options.annotation.target });

      var queries = _.compact(qs);

      return this.performTimeSeriesQuery(queries, start, end).then(function(results) {
        if(results.data[0]) {
          var annotationObject = results.data[0].annotations;
          if(options.annotation.isGlobal){
            annotationObject = results.data[0].globalAnnotations;
          }
          if(annotationObject) {
            _.each(annotationObject, function(annotation) {
              var event = {
                title: annotation.description,
                time: Math.floor(annotation.startTime) * 1000,
                text: annotation.notes,
                annotation: options.annotation
              };

              eventList.push(event);
            });
          }
        }
        return eventList;

      }.bind(this));
    };
    this.annotationQuery2 = function (options) {
      var annotation = options.annotation;
      var start = convertToTSDBTime(options.rangeRaw.from, false);
      var end = convertToTSDBTime(options.rangeRaw.to, true);
      var queries = [{
        "metric": contextSrv.user.orgId + "." + contextSrv.user.systemId + "." + "service.startAtSec",
        "aggregator": "sum",
        "downsample": "1m-avg",
        "tags": {
          "host": "*",
          "service": "*"
        }
      }];

      return this.performTimeSeriesQuery(queries, start, end).then(function (response) {
        var list = [];
        _.each(response.data, function (result) {
          _.each(result.dps, function (key, value) {
            var event = {
              annotation: annotation,
              time: key * 1000,
              title: "服务启动时间",
              tags: result.tags.host + "," + result.tags.service,
              text: ""
            };
            list.push(event);
          });
        });
        return list;
      });
    };

    this.performTimeSeriesQuery = function(queries, start, end) {
      var msResolution = false;
      if (this.tsdbResolution === 2) {
        msResolution = true;
      }
      var reqBody = {
        start: start,
        queries: queries,
        msResolution: msResolution,
        globalAnnotations: true
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        reqBody.end = end;
      }

      var options = {
        method: 'POST',
        url: this.url + '/api/query',
        data: reqBody
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }

      if (this.basicAuth) {
        options.headers = {"Authorization": this.basicAuth};
      }

      // In case the backend is 3rd-party hosted and does not suport OPTIONS, urlencoded requests
      // go as POST rather than OPTIONS+POST
      options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

      return backendSrv.datasourceRequest(options);
    };

    this.suggestTagKeys = function(metric) {
      return $q.when(this.tagKeys[metric] || []);
    };

    this._saveTagKeys = function(metricData) {
      var tagKeys = Object.keys(metricData.tags);
      _.each(metricData.aggregateTags, function(tag) {
        tagKeys.push(tag);
      });

      this.tagKeys[metricData.metric] = tagKeys;
    };

    this._performSuggestQuery = function(query, type) {
      return this._get('/api/suggest', {type: type, q: query, max: 1000}).then(function(result) {
        if(result.data.length < 13) {
          return result.data;
        }
        return _.filter(result.data, function(suggest) {
          return _.excludeMetricSuffix(suggest);
        });;
      });
    };

    this._performMetricKeyValueLookup = function(metric, key) {
      if(!metric || !key) {
        return $q.when([]);
      }

      var m = this.prefix + metric + "{" + key + "=*}";

      return this._get('/api/search/lookup', {m: m, limit: 3000}).then(function(result) {
        result = result.data.results;
        var tagvs = [];
        _.each(result, function(r) {
          if (tagvs.indexOf(r.tags[key]) === -1) {
            tagvs.push(r.tags[key]);
          }
        });
        return tagvs;
      });
    };

    this._performMetricKeyLookup = function(metric) {
      if(!metric) { return $q.when([]); }

      return this._get('/api/search/lookup', {m: this.prefix + metric, limit: 1000}).then(function(result) {
        result = result.data.results;
        var tagks = [];
        _.each(result, function(r) {
          _.each(r.tags, function(tagv, tagk) {
            if(tagks.indexOf(tagk) === -1) {
              tagks.push(tagk);
            }
          });
        });
        return tagks;
      });
    };

    this._get = function(relativeUrl, params) {
      return backendSrv.datasourceRequest({
        method: 'GET',
        url: this.url + relativeUrl,
        params: params,
      });
    };

    this.metricFindQuery = function(query) {
      this.prefix = contextSrv.user.orgId + "." + contextSrv.user.systemId + ".";
      if (!query) { return $q.when([]); }

      var self = this;
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      var type = null;
      var responseTransform = function(result) {
        if (type && (type === 'metrics')) {
          return _.map(result, function(value) {
            return {text: value.replace(self.prefix, '')};
          });
        }
        return _.map(result, function(value) {
          return {text: value};
        });
      };

      var metrics_regex = /metrics\((.*)\)/;
      var tag_names_regex = /tag_names\((.*)\)/;
      var tag_values_regex = /tag_values\((.*),\s?(.*)\)/;
      var tag_names_suggest_regex = /suggest_tagk\((.*)\)/;
      var tag_values_suggest_regex = /suggest_tagv\((.*)\)/;

      var metrics_query = interpolated.match(metrics_regex);
      if (metrics_query) {
        type = 'metrics';
        return this._performSuggestQuery(this.prefix + metrics_query[1], type).then(responseTransform);
      }

      var tag_names_query = interpolated.match(tag_names_regex);
      if (tag_names_query) {
        return this._performMetricKeyLookup(tag_names_query[1]).then(responseTransform);
      }

      var tag_values_query = interpolated.match(tag_values_regex);
      if (tag_values_query) {
        return this._performMetricKeyValueLookup(tag_values_query[1], tag_values_query[2]).then(responseTransform);
      }

      var tag_names_suggest_query = interpolated.match(tag_names_suggest_regex);
      if (tag_names_suggest_query) {
        type = 'tagk';
        return this._performSuggestQuery(tag_names_suggest_query[1], type).then(responseTransform);
      }

      var tag_values_suggest_query = interpolated.match(tag_values_suggest_regex);
      if (tag_values_suggest_query) {
        type = 'tagv';
        return this._performSuggestQuery(tag_values_suggest_query[1], type).then(responseTransform);
      }

      return $q.when([]);
    };

    this.testDatasource = function() {
      return this._performSuggestQuery('cpu', 'metrics').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    var aggregatorsPromise = null;
    this.getAggregators = function() {
      if (aggregatorsPromise) { return aggregatorsPromise; }

      aggregatorsPromise = this._get('/api/aggregators').then(function(result) {
        if (result.data && _.isArray(result.data)) {
          return result.data.sort();
        }
        return [];
      });
      return aggregatorsPromise;
    };

    var filterTypesPromise = null;
    this.getFilterTypes = function() {
      if (filterTypesPromise) { return filterTypesPromise; }

      filterTypesPromise = this._get('/api/config/filters').then(function(result) {
        if (result.data) {
          return Object.keys(result.data).sort();
        }
        return [];
      });
      return filterTypesPromise;
    };

    function transformMetricData(md, groupByTags, target, options, tsdbResolution, prefix) {
      var metricLabel = createMetricLabel(md, target, groupByTags, options, prefix);
      var dps = [];

      // TSDB returns datapoints has a hash of ts => value.
      // Can't use _.pairs(invert()) because it stringifies keys/values
      _.each(md.dps, function (v, k) {
        if (tsdbResolution === 2) {
          dps.push([v, k * 1]);
        } else {
          dps.push([v, k * 1000]);
        }
      });

      return { target: metricLabel, datapoints: dps };
    }

    function createMetricLabel(md, target, groupByTags, options, prefix) {
      if (target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(md.tags, function(value, key) {
          scopedVars['tag_' + key] = {value: value};
        });
        return templateSrv.replace(target.alias, scopedVars);
      }

      var label = md.metric.replace(prefix, '');
      var tagData = [];

      if (!_.isEmpty(md.tags)) {
        _.each(_.pairs(md.tags), function(tag) {
          if (_.has(groupByTags, tag[0])) {
            tagData.push(tag[0] + "=" + tag[1]);
          }
        });
      }

      if (!_.isEmpty(tagData)) {
        label += "{" + tagData.join(", ") + "}";
      }

      return label;
    }

    function convertTargetToQuery(target, options, prefix) {
      if (!target.metric || target.hide) {
        return null;
      }

      var query = {
        metric: prefix + templateSrv.replace(target.metric, options.scopedVars),
        aggregator: "avg"
      };

      if (target.aggregator) {
        query.aggregator = templateSrv.replace(target.aggregator);
      }

      if (target.shouldComputeRate) {
        query.rate = true;
        query.rateOptions = {
          counter: !!target.isCounter
        };

        if (target.counterMax && target.counterMax.length) {
          query.rateOptions.counterMax = parseInt(target.counterMax);
        }

        if (target.counterResetValue && target.counterResetValue.length) {
          query.rateOptions.resetValue = parseInt(target.counterResetValue);
        }
      }

      if (!target.disableDownsampling) {
        var interval =  templateSrv.replace(target.downsampleInterval || options.interval);

        if (interval.match(/\.[0-9]+s/)) {
          interval = parseFloat(interval)*1000 + "ms";
        }

        query.downsample = interval + "-" + target.downsampleAggregator;

        if (target.downsampleFillPolicy && target.downsampleFillPolicy !== "none") {
          query.downsample += "-" + target.downsampleFillPolicy;
        }
      }

      if (target.filters && target.filters.length > 0) {
        query.filters = angular.copy(target.filters);
      } else {
        query.tags = angular.copy(target.tags);
        if(query.tags){
          for(var key in query.tags){
            query.tags[key] = templateSrv.replace(query.tags[key], options.scopedVars, 'pipe');
          }
        }
      }

      return query;
    }

    function mapMetricsToTargets(metrics, options) {
      var interpolatedTagValue;
      return _.map(metrics, function(metricData) {
        return _.findIndex(options.targets, function(target) {
          if (target.filters && target.filters.length > 0) {
            return target.metric === metricData.metric &&
            _.all(target.filters, function(filter) {
              return filter.tagk === interpolatedTagValue === "*";
            });
          } else {
            return target.metric === metricData.metric &&
            _.all(target.tags, function(tagV, tagK) {
              interpolatedTagValue = templateSrv.replace(tagV, options.scopedVars, 'pipe');
              return metricData.tags[tagK] === interpolatedTagValue || interpolatedTagValue === "*";
            });
          }
        });
      });
    }

    function convertToTSDBTime(date, roundUp) {
      if (date === 'now') {
        return null;
      }

      date = dateMath.parse(date, roundUp);
      return date.valueOf();
    }

  }

  return {
    OpenTsDatasource: OpenTsDatasource
  };
});
