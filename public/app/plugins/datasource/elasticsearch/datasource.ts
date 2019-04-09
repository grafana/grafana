import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import { ElasticResponse } from './elastic_response';
import { IndexPattern } from './index_pattern';
import { ElasticQueryBuilder } from './query_builder';

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
    const options: any = {
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
    const range = this.timeSrv.timeRange();
    const indexList = this.indexPattern.getIndexList(range.from.valueOf(), range.to.valueOf());
    if (_.isArray(indexList) && indexList.length) {
      return this.request('GET', indexList[0] + url).then(results => {
        results.data.$$config = results.config;
        return results.data;
      });
    } else {
      return this.request('GET', this.indexPattern.getIndexForToday() + url).then(results => {
        results.data.$$config = results.config;
        return results.data;
      });
    }
  }

  private post(url, data) {
    return this.request('POST', url, data)
      .then(results => {
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
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const queryString = annotation.query || '*';
    const tagsField = annotation.tagsField || 'tags';
    const textField = annotation.textField || null;

    const range = {};
    range[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };

    const queryInterpolated = this.templateSrv.replace(queryString, {}, 'lucene');
    const query = {
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

    const data = {
      query: query,
      size: 10000,
    };

    // fields field not supported on ES 5.x
    if (this.esVersion < 5) {
      data['fields'] = [timeField, '_source'];
    }

    const header: any = {
      search_type: 'query_then_fetch',
      ignore_unavailable: true,
    };

    // old elastic annotations had index specified on them
    if (annotation.index) {
      header.index = annotation.index;
    } else {
      header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
    }

    const payload = angular.toJson(header) + '\n' + angular.toJson(data) + '\n';

    return this.post('_msearch', payload).then(res => {
      const list = [];
      const hits = res.responses[0].hits.hits;

      const getFieldFromSource = (source, fieldName) => {
        if (!fieldName) {
          return;
        }

        const fieldNames = fieldName.split('.');
        let fieldValue = source;

        for (let i = 0; i < fieldNames.length; i++) {
          fieldValue = fieldValue[fieldNames[i]];
          if (!fieldValue) {
            console.log('could not find field in annotation: ', fieldName);
            return '';
          }
        }

        return fieldValue;
      };

      for (let i = 0; i < hits.length; i++) {
        const source = hits[i]._source;
        let time = getFieldFromSource(source, timeField);
        if (typeof hits[i].fields !== 'undefined') {
          const fields = hits[i].fields;
          if (_.isString(fields[timeField]) || _.isNumber(fields[timeField])) {
            time = fields[timeField];
          }
        }

        const event = {
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
      dateFields => {
        const timeField = _.find(dateFields, { text: this.timeField });
        if (!timeField) {
          return {
            status: 'error',
            message: 'No date field named ' + this.timeField + ' found',
          };
        }
        return { status: 'success', message: 'Index OK. Time field name OK.' };
      },
      err => {
        console.log(err);
        if (err.data && err.data.error) {
          let message = angular.toJson(err.data.error);
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
    const queryHeader: any = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };
    if (this.esVersion >= 56) {
      queryHeader['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
    }
    return angular.toJson(queryHeader);
  }

  query(options) {
    let payload = '';
    const targets = _.cloneDeep(options.targets);
    const sentTargets = [];

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      if (target.alias) {
        target.alias = this.templateSrv.replace(target.alias, options.scopedVars, 'lucene');
      }

      const queryString = this.templateSrv.replace(target.query || '*', options.scopedVars, 'lucene');
      const queryObj = this.queryBuilder.build(target, adhocFilters, queryString);
      const esQuery = angular.toJson(queryObj);

      const searchType = queryObj.size === 0 && this.esVersion < 5 ? 'count' : 'query_then_fetch';
      const header = this.getQueryHeader(searchType, options.range.from, options.range.to);
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

    return this.post('_msearch', payload).then(res => {
      return new ElasticResponse(sentTargets, res).getTimeSeries();
    });
  }

  getFields(query) {
    return this.get('/_mapping').then(result => {
      const typeMap = {
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
      const fieldNameParts = [];
      const fields = {};

      function getFieldsRecursively(obj) {
        for (const key in obj) {
          const subObj = obj[key];

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
            const fieldName = fieldNameParts.concat(key).join('.');

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

      for (const indexName in result) {
        const index = result[indexName];
        if (index && index.mappings) {
          const mappings = index.mappings;
          for (const typeName in mappings) {
            const properties = mappings[typeName].properties;
            getFieldsRecursively(properties);
          }
        }
      }

      // transform to array
      return _.map(fields, value => {
        return value;
      });
    });
  }

  getTerms(queryDef) {
    const range = this.timeSrv.timeRange();
    const searchType = this.esVersion >= 5 ? 'query_then_fetch' : 'count';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf());
    esQuery = header + '\n' + esQuery + '\n';

    return this.post('_msearch?search_type=' + searchType, esQuery).then(res => {
      if (!res.responses[0].aggregations) {
        return [];
      }

      const buckets = res.responses[0].aggregations['1'].buckets;
      return _.map(buckets, bucket => {
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

    for (const bucketAgg of target.bucketAggs) {
      if (this.templateSrv.variableExists(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
        return true;
      }
    }

    for (const metric of target.metrics) {
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

    for (const key of Object.keys(obj)) {
      if (this.isPrimitive(obj[key])) {
        if (this.templateSrv.variableExists(obj[key])) {
          return true;
        }
      } else if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
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
