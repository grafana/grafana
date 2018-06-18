import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import { ElasticQueryBuilder } from './query_builder';
import { IndexPattern } from './index_pattern';
import { ElasticResponse } from './elastic_response';

export class ElasticDatasource {
  basicAuth: string;
  withCredentials: boolean;
  url: string;
  name: string;
  index: string;
  timeField: string;
  esVersion: number;
  interval: string;
  maxConcurrentShardRequests: number;
  queryBuilder: ElasticQueryBuilder;
  indexPattern: IndexPattern;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv, private timeSrv) {
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.index = instanceSettings.index;
    this.timeField = instanceSettings.jsonData.timeField;
    this.esVersion = instanceSettings.jsonData.esVersion;
    this.indexPattern = new IndexPattern(instanceSettings.index, instanceSettings.jsonData.interval);
    this.interval = instanceSettings.jsonData.timeInterval;
    this.maxConcurrentShardRequests = instanceSettings.jsonData.maxConcurrentShardRequests;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
      esVersion: this.esVersion,
    });
  }

  private request(method, url, data?) {
    var options: any = {
      url: this.url + '/' + url,
      method: method,
      data: data,
    };

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = {
        Authorization: this.basicAuth,
      };
    }

    return this.backendSrv.datasourceRequest(options);
  }

  private get(url) {
    var range = this.timeSrv.timeRange();
    var index_list = this.indexPattern.getIndexList(range.from.valueOf(), range.to.valueOf());
    if (_.isArray(index_list) && index_list.length) {
      return this.request('GET', index_list[0] + url).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    } else {
      return this.request('GET', this.indexPattern.getIndexForToday() + url).then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      });
    }
  }

  private post(url, data) {
    return this.request('POST', url, data)
      .then(function(results) {
        results.data.$$config = results.config;
        return results.data;
      })
      .catch(err => {
        if (err.data && err.data.error) {
          throw {
            message: 'Elasticsearch error: ' + err.data.error.reason,
            error: err.data.error,
          };
        }

        throw err;
      });
  }

  annotationQuery(options) {
    var annotation = options.annotation;
    var timeField = annotation.timeField || '@timestamp';
    var queryString = annotation.query || '*';
    var tagsField = annotation.tagsField || 'tags';
    var textField = annotation.textField || null;

    var range = {};
    range[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };

    var queryInterpolated = this.templateSrv.replace(queryString, {}, 'lucene');
    var query = {
      bool: {
        filter: [
          { range: range },
          {
            query_string: {
              query: queryInterpolated,
            },
          },
        ],
      },
    };

    var data = {
      query: query,
      size: 10000,
    };

    // fields field not supported on ES 5.x
    if (this.esVersion < 5) {
      data['fields'] = [timeField, '_source'];
    }

    var header: any = {
      search_type: 'query_then_fetch',
      ignore_unavailable: true,
    };

    // old elastic annotations had index specified on them
    if (annotation.index) {
      header.index = annotation.index;
    } else {
      header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
    }

    var payload = angular.toJson(header) + '\n' + angular.toJson(data) + '\n';

    return this.post('_msearch', payload).then(res => {
      var list = [];
      var hits = res.responses[0].hits.hits;

      var getFieldFromSource = function(source, fieldName) {
        if (!fieldName) {
          return;
        }

        var fieldNames = fieldName.split('.');
        var fieldValue = source;

        for (var i = 0; i < fieldNames.length; i++) {
          fieldValue = fieldValue[fieldNames[i]];
          if (!fieldValue) {
            console.log('could not find field in annotation: ', fieldName);
            return '';
          }
        }

        return fieldValue;
      };

      for (var i = 0; i < hits.length; i++) {
        var source = hits[i]._source;
        var time = getFieldFromSource(source, timeField);
        if (typeof hits[i].fields !== 'undefined') {
          var fields = hits[i].fields;
          if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
            time = fields[timeField];
          }
        }

        var event = {
          annotation: annotation,
          time: moment.utc(time).valueOf(),
          text: getFieldFromSource(source, textField),
          tags: getFieldFromSource(source, tagsField),
        };

        // legacy support for title tield
        if (annotation.titleField) {
          const title = getFieldFromSource(source, annotation.titleField);
          if (title) {
            event.text = title + '\n' + event.text;
          }
        }

        if (typeof event.tags === 'string') {
          event.tags = event.tags.split(',');
        }

        list.push(event);
      }
      return list;
    });
  }

  testDatasource() {
    this.timeSrv.setTime({ from: 'now-1m', to: 'now' }, true);
    // validate that the index exist and has date field
    return this.getFields({ type: 'date' }).then(
      function(dateFields) {
        var timeField = _.find(dateFields, { text: this.timeField });
        if (!timeField) {
          return {
            status: 'error',
            message: 'No date field named ' + this.timeField + ' found',
          };
        }
        return { status: 'success', message: 'Index OK. Time field name OK.' };
      }.bind(this),
      function(err) {
        console.log(err);
        if (err.data && err.data.error) {
          var message = angular.toJson(err.data.error);
          if (err.data.error.reason) {
            message = err.data.error.reason;
          }
          return { status: 'error', message: message };
        } else {
          return { status: 'error', message: err.status };
        }
      }
    );
  }

  getQueryHeader(searchType, timeFrom, timeTo) {
    var query_header: any = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };
    if (this.esVersion >= 56) {
      query_header['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
    }
    return angular.toJson(query_header);
  }

  query(options) {
    var payload = '';
    var target;
    var sentTargets = [];

    // add global adhoc filters to timeFilter
    var adhocFilters = this.templateSrv.getAdhocFilters(this.name);

    for (var i = 0; i < options.targets.length; i++) {
      target = options.targets[i];
      if (target.hide) {
        continue;
      }

      var queryString = this.templateSrv.replace(target.query || '*', options.scopedVars, 'lucene');
      var queryObj = this.queryBuilder.build(target, adhocFilters, queryString);
      var esQuery = angular.toJson(queryObj);

      var searchType = queryObj.size === 0 && this.esVersion < 5 ? 'count' : 'query_then_fetch';
      var header = this.getQueryHeader(searchType, options.range.from, options.range.to);
      payload += header + '\n';

      payload += esQuery + '\n';
      sentTargets.push(target);
    }

    if (sentTargets.length === 0) {
      return this.$q.when([]);
    }

    payload = payload.replace(/\$timeFrom/g, options.range.from.valueOf());
    payload = payload.replace(/\$timeTo/g, options.range.to.valueOf());
    payload = this.templateSrv.replace(payload, options.scopedVars);

    return this.post('_msearch', payload).then(function(res) {
      return new ElasticResponse(sentTargets, res).getTimeSeries();
    });
  }

  getFields(query) {
    return this.get('/_mapping').then(function(result) {
      var typeMap = {
        float: 'number',
        double: 'number',
        integer: 'number',
        long: 'number',
        date: 'date',
        string: 'string',
        text: 'string',
        scaled_float: 'number',
        nested: 'nested',
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
                type: subObj.type,
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
  }

  getTerms(queryDef) {
    var range = this.timeSrv.timeRange();
    var searchType = this.esVersion >= 5 ? 'query_then_fetch' : 'count';
    var header = this.getQueryHeader(searchType, range.from, range.to);
    var esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf());
    esQuery = header + '\n' + esQuery + '\n';

    return this.post('_msearch?search_type=' + searchType, esQuery).then(function(res) {
      if (!res.responses[0].aggregations) {
        return [];
      }

      var buckets = res.responses[0].aggregations['1'].buckets;
      return _.map(buckets, function(bucket) {
        return {
          text: bucket.key_as_string || bucket.key,
          value: bucket.key,
        };
      });
    });
  }

  metricFindQuery(query) {
    query = angular.fromJson(query);
    if (!query) {
      return this.$q.when([]);
    }

    if (query.find === 'fields') {
      query.field = this.templateSrv.replace(query.field, {}, 'lucene');
      return this.getFields(query);
    }

    if (query.find === 'terms') {
      query.field = this.templateSrv.replace(query.field, {}, 'lucene');
      query.query = this.templateSrv.replace(query.query || '*', {}, 'lucene');
      return this.getTerms(query);
    }
  }

  getTagKeys() {
    return this.getFields({});
  }

  getTagValues(options) {
    return this.getTerms({ field: options.key, query: '*' });
  }

  targetContainsTemplate(target) {
    if (this.templateSrv.variableExists(target.query) || this.templateSrv.variableExists(target.alias)) {
      return true;
    }

    for (let bucketAgg of target.bucketAggs) {
      if (this.templateSrv.variableExists(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
        return true;
      }
    }

    for (let metric of target.metrics) {
      if (
        this.templateSrv.variableExists(metric.field) ||
        this.objectContainsTemplate(metric.settings) ||
        this.objectContainsTemplate(metric.meta)
      ) {
        return true;
      }
    }

    return false;
  }

  private isPrimitive(obj) {
    if (obj === null || obj === undefined) {
      return true;
    }
    if (['string', 'number', 'boolean'].some(type => type === typeof true)) {
      return true;
    }

    return false;
  }

  private objectContainsTemplate(obj) {
    if (!obj) {
      return false;
    }

    for (let key of Object.keys(obj)) {
      if (this.isPrimitive(obj[key])) {
        if (this.templateSrv.variableExists(obj[key])) {
          return true;
        }
      } else if (Array.isArray(obj[key])) {
        for (let item of obj[key]) {
          if (this.objectContainsTemplate(item)) {
            return true;
          }
        }
      } else {
        if (this.objectContainsTemplate(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }
}
