define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/kbn',
  './query_builder',
  './index_pattern',
  './elastic_response',
  './query_ctrl',
],
function (angular, _, moment, kbn, ElasticQueryBuilder, IndexPattern, ElasticResponse) {
  'use strict';

  ElasticResponse = ElasticResponse.ElasticResponse;

  /** @ngInject */
  function ElasticDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.index = instanceSettings.index;
    this.timeField = instanceSettings.jsonData.timeField;
    this.esVersion = instanceSettings.jsonData.esVersion;
    this.indexPattern = new IndexPattern(instanceSettings.index, instanceSettings.jsonData.interval);
    this.interval = instanceSettings.jsonData.timeInterval;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
      esVersion: this.esVersion,
    });

    this._request = function(method, url, data) {
      var options = {
        url: this.url + "/" + url,
        method: method,
        data: data
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    this._get = function(url) {
      var range = timeSrv.timeRange();
      var index_list = this.indexPattern.getIndexList(range.from.valueOf(), range.to.valueOf());
      if (_.isArray(index_list) && index_list.length) {
        return this._request('GET', index_list[0] + url).then(function(results) {
          results.data.$$config = results.config;
          return results.data;
        });
      } else {
        return this._request('GET', this.indexPattern.getIndexForToday() + url).then(function(results) {
          results.data.$$config = results.config;
          return results.data;
        });
      }
    };

    this._post = function(url, data) {
      return this._request('POST', url, data).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    };

    this.annotationQuery = function(options) {
      var annotation = options.annotation;
      var timeField = annotation.timeField || '@timestamp';
      var queryString = annotation.query || '*';
      var tagsField = annotation.tagsField || 'tags';
      var titleField = annotation.titleField || 'desc';
      var textField = annotation.textField || null;

      var range = {};
      range[timeField]= {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        format: "epoch_millis",
      };

      var queryInterpolated = templateSrv.replace(queryString, {}, 'lucene');
      var query = {
        "bool": {
          "filter": [
            { "range": range },
            {
              "query_string": {
                "query": queryInterpolated
              }
            }
          ]
        }
      };

      var data = {
        "query" : query,
        "size": 10000
      };

      // fields field not supported on ES 5.x
      if (this.esVersion < 5) {
        data["fields"] = [timeField, "_source"];
      }

      var header = {search_type: "query_then_fetch", "ignore_unavailable": true};

      // old elastic annotations had index specified on them
      if (annotation.index) {
        header.index = annotation.index;
      } else {
        header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
      }

      var payload = angular.toJson(header) + '\n' + angular.toJson(data) + '\n';

      return this._post('_msearch', payload).then(function(res) {
        var list = [];
        var hits = res.responses[0].hits.hits;

        var getFieldFromSource = function(source, fieldName) {
          if (!fieldName) { return; }

          var fieldNames = fieldName.split('.');
          var fieldValue = source;

          for (var i = 0; i < fieldNames.length; i++) {
            fieldValue = fieldValue[fieldNames[i]];
            if (!fieldValue) {
              console.log('could not find field in annotation: ', fieldName);
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
          var time = source[timeField];
          if (typeof hits[i].fields !== 'undefined') {
            var fields = hits[i].fields;
            if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
              time = fields[timeField];
            }
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

    this.testDatasource = function() {
      timeSrv.setTime({ from: 'now-1m', to: 'now' }, true);
      // validate that the index exist and has date field
      return this.getFields({type: 'date'}).then(function(dateFields) {
        var timeField = _.find(dateFields, {text: this.timeField});
        if (!timeField) {
          return { status: "error", message: "No date field named " + this.timeField + ' found' };
        }
        return { status: "success", message: "Index OK. Time field name OK." };
      }.bind(this), function(err) {
        console.log(err);
        if (err.data && err.data.error) {
          var message = angular.toJson(err.data.error);
          if (err.data.error.reason) {
            message = err.data.error.reason;
          }
          return { status: "error", message: message };
        } else {
          return { status: "error", message: err.status };
        }
      });
    };

    this.getQueryHeader = function(searchType, timeFrom, timeTo) {
      var header = {search_type: searchType, "ignore_unavailable": true};
      header.index = this.indexPattern.getIndexList(timeFrom, timeTo);
      return angular.toJson(header);
    };

    this.query = function(options) {
      var payload = "";
      var target;
      var sentTargets = [];

      // add global adhoc filters to timeFilter
      var adhocFilters = templateSrv.getAdhocFilters(this.name);

      for (var i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (target.hide) {continue;}

        var queryString = templateSrv.replace(target.query || '*', options.scopedVars, 'lucene');
        var queryObj = this.queryBuilder.build(target, adhocFilters, queryString);
        var esQuery = angular.toJson(queryObj);

        var searchType = (queryObj.size === 0 && this.esVersion < 5) ? 'count' : 'query_then_fetch';
        var header = this.getQueryHeader(searchType, options.range.from, options.range.to);
        payload +=  header + '\n';

        payload += esQuery + '\n';
        sentTargets.push(target);
      }

      if (sentTargets.length === 0) {
        return $q.when([]);
      }

      payload = payload.replace(/\$timeFrom/g, options.range.from.valueOf());
      payload = payload.replace(/\$timeTo/g, options.range.to.valueOf());
      payload = templateSrv.replace(payload, options.scopedVars);

      return this._post('_msearch', payload).then(function(res) {
        return new ElasticResponse(sentTargets, res).getTimeSeries();
      });
    };

    this.getFields = function(query) {
      return this._get('/_mapping').then(function(result) {

        var typeMap = {
          'float': 'number',
          'double': 'number',
          'integer': 'number',
          'long': 'number',
          'date': 'date',
          'string': 'string',
          'text': 'string',
          'scaled_float': 'number',
          'nested': 'nested'
        };

        function shouldAddField(obj, key, query) {
          if (key[0] === '_') {
            return false;
          }

          if (!query.type) {
            return true;
          }

          // equal query type filter, or via typemap translation
          return query.type === obj.type || query.type === typeMap[obj.type];
        }

        // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
        var fieldNameParts = [];
        var fields = {};

        function getFieldsRecursively(obj) {
          for (var key in obj) {
            var subObj = obj[key];

            // Check mapping field for nested fields
            if (_.isObject(subObj.properties)) {
              fieldNameParts.push(key);
              getFieldsRecursively(subObj.properties);
            }

            if (_.isObject(subObj.fields)) {
              fieldNameParts.push(key);
              getFieldsRecursively(subObj.fields);
            }

            if (_.isString(subObj.type)) {
              var fieldName = fieldNameParts.concat(key).join('.');

              // Hide meta-fields and check field type
              if (shouldAddField(subObj, key, query)) {
                fields[fieldName] = {
                  text: fieldName,
                  type: subObj.type
                };
              }
            }
          }
          fieldNameParts.pop();
        }

        for (var indexName in result) {
          var index = result[indexName];
          if (index && index.mappings) {
            var mappings = index.mappings;
            for (var typeName in mappings) {
              var properties = mappings[typeName].properties;
              getFieldsRecursively(properties);
            }
          }
        }

        // transform to array
        return _.map(fields, function(value) {
          return value;
        });
      });
    };

    this.getTerms = function(queryDef) {
      var range = timeSrv.timeRange();
      var searchType = this.esVersion >= 5 ? 'query_then_fetch' : 'count' ;
      var header = this.getQueryHeader(searchType, range.from, range.to);
      var esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

      esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf());
      esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf());
      esQuery = header + '\n' + esQuery + '\n';

      return this._post('_msearch?search_type=' + searchType, esQuery).then(function(res) {
        if (!res.responses[0].aggregations) {
          return [];
        }

        var buckets = res.responses[0].aggregations["1"].buckets;
        return _.map(buckets, function(bucket) {
          return {
            text: bucket.key_as_string || bucket.key,
            value: bucket.key
          };
        });
      });
    };

    this.metricFindQuery = function(query) {
      query = angular.fromJson(query);
      if (!query) {
        return $q.when([]);
      }

      if (query.find === 'fields') {
        query.field = templateSrv.replace(query.field, {}, 'lucene');
        return this.getFields(query);
      }

      if (query.find === 'terms') {
        query.query = templateSrv.replace(query.query || '*', {}, 'lucene');
        return this.getTerms(query);
      }
    };

    this.getTagKeys = function() {
      return this.getFields({});
    };

    this.getTagValues = function(options) {
      return this.getTerms({field: options.key, query: '*'});
    };
  }

  return {
    ElasticDatasource: ElasticDatasource
  };
});
