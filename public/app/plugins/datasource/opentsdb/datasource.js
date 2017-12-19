define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  'moment',
],
function (angular, _, dateMath) {
  'use strict';

  /** @ngInject */
  function OpenTsDatasource(instanceSettings, $q, backendSrv, templateSrv) {
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

    // Called once per panel (graph)
    this.query = function(options) {
      var start = convertToTSDBTime(options.rangeRaw.from, false);
      var end = convertToTSDBTime(options.rangeRaw.to, true);
      var qs = [];
      var exps = [];

      _.each(options.targets, function(target) {
        if (!target.metric && !target.exp) { return; }
        if (target.queryType === 'metric') {
          qs.push(convertTargetToQuery(target, options));
        } else if (target.queryType === 'exp') {
          exps.push(target);
        }
      });

      var queries = _.compact(qs);
      var expressions;

      if(exps.length > 0) {
        expressions = convertTargetsToExpression(exps, options);
      }

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries) && _.isEmpty(expressions)){
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

      var result = {};
      result.data = [];
      var queriesPromise;
      var expressionsPromise;

      if (queries.length > 0) {
        queriesPromise = this.performTimeSeriesQuery(queries, start, end).then(function(response) {
          var metricToTargetMapping = mapMetricsToTargets(response.data, options, this.tsdbVersion);
          return _.map(response.data, function(metricData, index) {
            index = metricToTargetMapping[index];
            if (index === -1) {
              index = 0;
            }
            this._saveTagKeys(metricData);
            return transformMetricData(metricData, groupByTags, options.targets[index], options, this.tsdbResolution);
          }.bind(this));
        }.bind(this));
      }

      if(expressions && expressions.outputs.length > 0) {
        expressionsPromise = this.performTimeSeriesExpressionQuery(expressions, start, end).then(function (response) {
          return _.map(response.data.outputs, function(metricData) {
            return transformExpressionsData(metricData, _.find(options.targets, {refId: metricData.id.toUpperCase()}), options);
          }.bind(this));
        }.bind(this));
      }

      return $q.all([queriesPromise, expressionsPromise]).then(function(data) {
        if (data[0] && data[0].length > 0) {
          result.data = result.data.concat(data[0]);
        }
        if (data[1] && data[1].length > 0) {
          result.data = _.flatten(result.data.concat(data[1]));
        }
        return result;
      });
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
                text: annotation.description,
                time: Math.floor(annotation.startTime) * 1000,
                annotation: options.annotation
              };

              eventList.push(event);
            });
          }
        }
        return eventList;

      }.bind(this));
    };

    this.targetContainsTemplate = function(target) {
      if (target.filters && target.filters.length > 0) {
        for (var i = 0; i < target.filters.length; i++) {
          if (templateSrv.variableExists(target.filters[i].filter)) {
            return true;
          }
        }
      }

      if (target.tags && Object.keys(target.tags).length > 0) {
        for (var tagKey in target.tags) {
          if (templateSrv.variableExists(target.tags[tagKey])) {
            return true;
          }
        }
      }

      return false;
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
      if (this.tsdbVersion === 3) {
        reqBody.showQuery = true;
      }

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        reqBody.end = end;
      }

      var options = {
        method: 'POST',
        url: this.url + '/api/query',
        data: reqBody
      };

      this._addCredentialOptions(options);
      return backendSrv.datasourceRequest(options);
    };

    this.performTimeSeriesExpressionQuery = function(expressions, start, end) {
      var reqBody = expressions;
      reqBody.time = {
        start: start,
        aggregator: 'sum'
      };

      // Relative queries (e.g. last hour) don't include an end time
      if (end) {
        reqBody.time.end = end;
      }

      var options = {
        method: 'POST',
        url: this.url + '/api/query/exp',
        data: reqBody
      };

      this._addCredentialOptions(options);
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
        return result.data;
      });
    };

    this._performMetricKeyValueLookup = function(metric, keys) {

      if(!metric || !keys) {
        return $q.when([]);
      }

      var keysArray = keys.split(",").map(function(key) {
        return key.trim();
      });
      var key = keysArray[0];
      var keysQuery = key + "=*";

      if (keysArray.length > 1) {
        keysQuery += "," + keysArray.splice(1).join(",");
      }

      var m = metric + "{" + keysQuery + "}";

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

      return this._get('/api/search/lookup', {m: metric, limit: 1000}).then(function(result) {
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
      var options = {
        method: 'GET',
        url: this.url + relativeUrl,
        params: params,
      };

      this._addCredentialOptions(options);

      return backendSrv.datasourceRequest(options);
    };

    this._addCredentialOptions = function(options) {
      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = {"Authorization": this.basicAuth};
      }
    };

    this.metricFindQuery = function(query) {
      if (!query) { return $q.when([]); }

      var interpolated;
      try {
        interpolated = templateSrv.replace(query, {}, 'distributed');
      }
      catch (err) {
        return $q.reject(err);
      }

      var responseTransform = function(result) {
        return _.map(result, function(value) {
          return {text: value};
        });
      };

      var metrics_regex = /metrics\((.*)\)/;
      var tag_names_regex = /tag_names\((.*)\)/;
      var tag_values_regex = /tag_values\((.*?),\s?(.*)\)/;
      var tag_names_suggest_regex = /suggest_tagk\((.*)\)/;
      var tag_values_suggest_regex = /suggest_tagv\((.*)\)/;

      var metrics_query = interpolated.match(metrics_regex);
      if (metrics_query) {
        return this._performSuggestQuery(metrics_query[1], 'metrics').then(responseTransform);
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
        return this._performSuggestQuery(tag_names_suggest_query[1], 'tagk').then(responseTransform);
      }

      var tag_values_suggest_query = interpolated.match(tag_values_suggest_regex);
      if (tag_values_suggest_query) {
        return this._performSuggestQuery(tag_values_suggest_query[1], 'tagv').then(responseTransform);
      }

      return $q.when([]);
    };

    this.testDatasource = function() {
      return this._performSuggestQuery('cpu', 'metrics').then(function () {
        return { status: "success", message: "Data source is working" };
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

    function transformMetricData(md, groupByTags, target, options, tsdbResolution) {
      var metricLabel = createMetricLabel(md, target, groupByTags, options);
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

    function createMetricLabel(md, target, groupByTags, options) {
      if (target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(md.tags, function(value, key) {
          scopedVars['tag_' + key] = {value: value};
        });
        return templateSrv.replace(target.alias, scopedVars);
      }

      var label = md.metric;
      var tagData = [];

      if (!_.isEmpty(md.tags)) {
        _.each(_.toPairs(md.tags), function(tag) {
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

    function transformExpressionsData(md, target, options) {
      var outputData = [];
      if(md.meta.length > 0) {
        _.forEach(md.meta, function(meta) {
          if(meta.index === 0) {
            return;
          }

          var metricLabel = createExpressionLabel(meta, target, options);
          var dps = [];

          _.each(md.dps, function(point) {
            dps.push([point[meta.index], point[0]]);
          });

          outputData.push({
            target: metricLabel,
            datapoints: dps
          });
        });
      }
      return outputData;
    }

    function createExpressionLabel(meta, target, options) {
      if(target.alias) {
        var scopedVars = _.clone(options.scopedVars || {});
        _.each(meta.commonTags, function(tagV, tagK) {
          scopedVars['tag_' + tagK] = {
            value: tagV
          };
        });
        return templateSrv.replace(target.alias, scopedVars);
      }

      var label = meta.metrics.join(', ');
      var tagData = [];

      if(_.size(meta.commonTags) > 0) {
        _.each(meta.commonTags, function(tagV, tagK) {
          tagData.push(tagK + '=' + tagV);
        });
        label += '{' + tagData.join(', ') + '}';
      }

      return label;
    }

    function convertTargetToQuery(target, options, tsdbVersion) {
      if (!target.metric || target.hide) {
        return null;
      }

      var query = {
        metric: templateSrv.replace(target.metric, options.scopedVars, 'pipe'),
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

        if(tsdbVersion >= 2) {
          query.rateOptions.dropResets = !query.rateOptions.counterMax &&
                (!query.rateOptions.ResetValue || query.rateOptions.ResetValue === 0);
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
        if (query.filters){
          for (var filter_key in query.filters) {
            query.filters[filter_key].filter = templateSrv.replace(query.filters[filter_key].filter, options.scopedVars, 'pipe');
          }
        }
      } else {
        query.tags = angular.copy(target.tags);
        if (query.tags){
          for (var tag_key in query.tags) {
            query.tags[tag_key] = templateSrv.replace(query.tags[tag_key], options.scopedVars, 'pipe');
          }
        }
      }

      if (target.explicitTags) {
        query.explicitTags = true;
      }

      return query;
    }

    function convertTargetsToExpression(targetExps, options) {
      var expressions = [];
      var outputs = [];
      var metricIds = []; // metric refIds used in expressions

      _.each(_.filter(targetExps, { queryType: 'exp' }), function (target) {
        if (!target.exp) {
          return;
        }

        metricIds.push.apply(metricIds, target.exp.toLowerCase().match(/[a-zA-Z]+/g));

        //create and push expressions
        var expression = {
          id: target.refId.toLowerCase(),
          expr: target.exp.toLowerCase()
        };

        if (target.shouldJoin) {
          expression.join = {
            operator: target.join.operator,
            useQueryTags: target.join.useQueryTags,
            includeAggTags: target.join.includeAggTags
          };
        }

        if (target.expFillPolicy !== 'none') {
          var fillPolicy = {
            policy: target.expFillPolicy
          };

          if (target.expFillPolicy === 'scalar') {
            fillPolicy.value = target.expFillValue;
          }

          expression.fillPolicy = fillPolicy;
        }

        expressions.push(expression);

        if (!target.hide) {
          outputs.push({
            id: target.refId.toLowerCase(),
            alias: target.refId
          });
        }
      });

      //create metrics and filters to be used in expressions
      var expOptions = createExpressionOptions(options.targets, _.uniq(metricIds));

      return {
        filters: expOptions.filters,
        metrics: expOptions.metrics,
        expressions: expressions,
        outputs: outputs
      };
    }

    function createExpressionOptions (targets, metricIds){
      var filterId = 1;
      var metrics = [];
      var filters = [];

      _.each(targets, function(target)
      {
        if (!target.metric || !_.includes(metricIds, target.refId.toLowerCase())) {
          return;
        }

        var metric = {
          id: target.refId.toLowerCase(),
          metric: target.metric,
          aggregator: target.aggregator
        };

        if (target.downsampleFillPolicy !== 'none') {
          var fillPolicy = {
            policy: target.downsampleFillPolicy
          };

          if (target.downsampleFillPolicy === 'scalar') {
            fillPolicy.value = target.downsampleFillValue;
          }
          metric.fillPolicy = fillPolicy;
        }

        if (target.filters.length > 0) {
          filters.push({
            id: 'f' + filterId,
            tags: target.filters
          });
          metric.filter = 'f' + filterId;
          filterId++;
        }

        metrics.push(metric);
      });

      return {
        metrics: metrics,
        filters: filters
      };
    }

    function mapMetricsToTargets(metrics, options, tsdbVersion) {
      var interpolatedTagValue, arrTagV;
      return _.map(metrics, function(metricData) {
        if (tsdbVersion === 3) {
          return metricData.query.index;
        } else {
          return _.findIndex(options.targets, function(target) {
            if (target.filters && target.filters.length > 0) {
              return target.metric === metricData.metric;
            } else {
              return target.metric === metricData.metric &&
              _.every(target.tags, function(tagV, tagK) {
                interpolatedTagValue = templateSrv.replace(tagV, options.scopedVars, 'pipe');
                arrTagV = interpolatedTagValue.split('|');
                return _.includes(arrTagV, metricData.tags[tagK]) || interpolatedTagValue === "*";
              });
            }
          });
        }
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

  return OpenTsDatasource;
});
