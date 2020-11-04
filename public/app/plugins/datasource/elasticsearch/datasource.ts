import angular from 'angular';
import _ from 'lodash';
import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  ScopedVars,
  DataLink,
  PluginMeta,
  DataQuery,
} from '@grafana/data';
import LanguageProvider from './language_provider';
import { ElasticResponse } from './elastic_response';
import { IndexPattern } from './index_pattern';
import { ElasticQueryBuilder } from './query_builder';
import { toUtc } from '@grafana/data';
import * as queryDef from './query_def';
import { getBackendSrv } from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DataLinkConfig, ElasticsearchOptions, ElasticsearchQuery } from './types';

// Those are metadata fields as defined in https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-fields.html#_identity_metadata_fields.
// custom fields can start with underscores, therefore is not safe to exclude anything that starts with one.
const ELASTIC_META_FIELDS = [
  '_index',
  '_type',
  '_id',
  '_source',
  '_size',
  '_field_names',
  '_ignored',
  '_routing',
  '_meta',
];

export class ElasticDatasource extends DataSourceApi<ElasticsearchQuery, ElasticsearchOptions> {
  basicAuth?: string;
  withCredentials?: boolean;
  url: string;
  name: string;
  index: string;
  timeField: string;
  esVersion: number;
  interval: string;
  maxConcurrentShardRequests?: number;
  queryBuilder: ElasticQueryBuilder;
  indexPattern: IndexPattern;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks: DataLinkConfig[];
  languageProvider: LanguageProvider;

  constructor(
    instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url!;
    this.name = instanceSettings.name;
    this.index = instanceSettings.database ?? '';
    const settingsData = instanceSettings.jsonData || ({} as ElasticsearchOptions);

    this.timeField = settingsData.timeField;
    this.esVersion = settingsData.esVersion;
    this.indexPattern = new IndexPattern(this.index, settingsData.interval);
    this.interval = settingsData.timeInterval;
    this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
      esVersion: this.esVersion,
    });
    this.logMessageField = settingsData.logMessageField || '';
    this.logLevelField = settingsData.logLevelField || '';
    this.dataLinks = settingsData.dataLinks || [];

    if (this.logMessageField === '') {
      this.logMessageField = undefined;
    }

    if (this.logLevelField === '') {
      this.logLevelField = undefined;
    }
    this.languageProvider = new LanguageProvider(this);
  }

  private request(method: string, url: string, data?: undefined) {
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

    return getBackendSrv()
      .datasourceRequest(options)
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: 'Elasticsearch error: ' + err.data.error.reason,
            error: err.data.error,
          };
        }
        throw err;
      });
  }

  async importQueries(queries: DataQuery[], originMeta: PluginMeta): Promise<ElasticsearchQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  /**
   * Sends a GET request to the specified url on the newest matching and available index.
   *
   * When multiple indices span the provided time range, the request is sent starting from the newest index,
   * and then going backwards until an index is found.
   *
   * @param url the url to query the index on, for example `/_mapping`.
   */
  private get(url: string) {
    const range = this.timeSrv.timeRange();
    const indexList = this.indexPattern.getIndexList(range.from.valueOf(), range.to.valueOf());
    if (_.isArray(indexList) && indexList.length) {
      return this.requestAllIndices(indexList, url).then((results: any) => {
        results.data.$$config = results.config;
        return results.data;
      });
    } else {
      return this.request('GET', this.indexPattern.getIndexForToday() + url).then((results: any) => {
        results.data.$$config = results.config;
        return results.data;
      });
    }
  }

  private async requestAllIndices(indexList: string[], url: string): Promise<any> {
    const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
    const listLen = indexList.length;
    for (let i = 0; i < Math.min(listLen, maxTraversals); i++) {
      try {
        return await this.request('GET', indexList[listLen - i - 1] + url);
      } catch (err) {
        if (err.status !== 404 || i === maxTraversals - 1) {
          throw err;
        }
      }
    }
  }

  private post(url: string, data: any) {
    return this.request('POST', url, data).then((results: any) => {
      results.data.$$config = results.config;
      return results.data;
    });
  }

  annotationQuery(options: any): Promise<any> {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const queryString = annotation.query || '*';
    const tagsField = annotation.tagsField || 'tags';
    const textField = annotation.textField || null;

    const dateRanges = [];
    const rangeStart: any = {};
    rangeStart[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };
    dateRanges.push({ range: rangeStart });

    if (timeEndField) {
      const rangeEnd: any = {};
      rangeEnd[timeEndField] = {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        format: 'epoch_millis',
      };
      dateRanges.push({ range: rangeEnd });
    }

    const queryInterpolated = this.templateSrv.replace(queryString, {}, 'lucene');
    const query = {
      bool: {
        filter: [
          {
            bool: {
              should: dateRanges,
              minimum_should_match: 1,
            },
          },
          {
            query_string: {
              query: queryInterpolated,
            },
          },
        ],
      },
    };

    const data: any = {
      query,
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

    return this.post('_msearch', payload).then((res: any) => {
      const list = [];
      const hits = res.responses[0].hits.hits;

      const getFieldFromSource = (source: any, fieldName: any) => {
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

        const event: {
          annotation: any;
          time: number;
          timeEnd?: number;
          text: string;
          tags: string | string[];
        } = {
          annotation: annotation,
          time: toUtc(time).valueOf(),
          text: getFieldFromSource(source, textField),
          tags: getFieldFromSource(source, tagsField),
        };

        if (timeEndField) {
          const timeEnd = getFieldFromSource(source, timeEndField);
          if (timeEnd) {
            event.timeEnd = toUtc(timeEnd).valueOf();
          }
        }

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

  interpolateVariablesInQueries(queries: ElasticsearchQuery[], scopedVars: ScopedVars): ElasticsearchQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          query: this.templateSrv.replace(query.query, scopedVars, 'lucene'),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  testDatasource() {
    // validate that the index exist and has date field
    return this.getFields({ type: 'date' }).then(
      (dateFields: any) => {
        const timeField: any = _.find(dateFields, { text: this.timeField });
        if (!timeField) {
          return {
            status: 'error',
            message: 'No date field named ' + this.timeField + ' found',
          };
        }
        return { status: 'success', message: 'Index OK. Time field name OK.' };
      },
      (err: any) => {
        console.error(err);
        if (err.message) {
          return { status: 'error', message: err.message };
        } else {
          return { status: 'error', message: err.status };
        }
      }
    );
  }

  getQueryHeader(searchType: any, timeFrom: any, timeTo: any) {
    const queryHeader: any = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };

    if (this.esVersion >= 56 && this.esVersion < 70) {
      queryHeader['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
    }

    return angular.toJson(queryHeader);
  }

  query(options: DataQueryRequest<ElasticsearchQuery>): Promise<DataQueryResponse> {
    let payload = '';
    const targets = _.cloneDeep(options.targets);
    const sentTargets: ElasticsearchQuery[] = [];

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      let queryString = this.templateSrv.replace(target.query, options.scopedVars, 'lucene');
      // Elasticsearch queryString should always be '*' if empty string
      if (!queryString || queryString === '') {
        queryString = '*';
      }

      let queryObj;
      if (target.isLogsQuery || queryDef.hasMetricOfType(target, 'logs')) {
        target.bucketAggs = [queryDef.defaultBucketAgg()];
        target.metrics = [];
        // Setting this for metrics queries that are typed as logs
        target.isLogsQuery = true;
        queryObj = this.queryBuilder.getLogsQuery(target, adhocFilters, queryString);
      } else {
        if (target.alias) {
          target.alias = this.templateSrv.replace(target.alias, options.scopedVars, 'lucene');
        }

        queryObj = this.queryBuilder.build(target, adhocFilters, queryString);
      }

      const esQuery = angular.toJson(queryObj);

      const searchType = queryObj.size === 0 && this.esVersion < 5 ? 'count' : 'query_then_fetch';
      const header = this.getQueryHeader(searchType, options.range.from, options.range.to);
      payload += header + '\n';

      payload += esQuery + '\n';

      sentTargets.push(target);
    }

    if (sentTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
    // it as an integer not as string with digits. This is because elastic will convert the string only if the time
    // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
    // and then sending string will error out.
    payload = payload.replace(/"\$timeFrom"/g, options.range.from.valueOf().toString());
    payload = payload.replace(/"\$timeTo"/g, options.range.to.valueOf().toString());
    payload = this.templateSrv.replace(payload, options.scopedVars);

    const url = this.getMultiSearchUrl();

    return this.post(url, payload).then((res: any) => {
      const er = new ElasticResponse(sentTargets, res);

      if (sentTargets.some(target => target.isLogsQuery)) {
        const response = er.getLogs(this.logMessageField, this.logLevelField);
        for (const dataFrame of response.data) {
          enhanceDataFrame(dataFrame, this.dataLinks);
        }
        return response;
      }

      return er.getTimeSeries();
    });
  }

  isMetadataField(fieldName: string) {
    return ELASTIC_META_FIELDS.includes(fieldName);
  }

  getFields(query: any) {
    const configuredEsVersion = this.esVersion;
    return this.get('/_mapping').then((result: any) => {
      const typeMap: any = {
        float: 'number',
        double: 'number',
        integer: 'number',
        long: 'number',
        date: 'date',
        date_nanos: 'date',
        string: 'string',
        text: 'string',
        scaled_float: 'number',
        nested: 'nested',
      };

      const shouldAddField = (obj: any, key: string, query: any) => {
        if (this.isMetadataField(key)) {
          return false;
        }

        if (!query.type) {
          return true;
        }

        // equal query type filter, or via typemap translation
        return query.type === obj.type || query.type === typeMap[obj.type];
      };

      // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
      const fieldNameParts: any = [];
      const fields: any = {};

      function getFieldsRecursively(obj: any) {
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

          if (configuredEsVersion < 70) {
            for (const typeName in mappings) {
              const properties = mappings[typeName].properties;
              getFieldsRecursively(properties);
            }
          } else {
            const properties = mappings.properties;
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

  getTerms(queryDef: any) {
    const range = this.timeSrv.timeRange();
    const searchType = this.esVersion >= 5 ? 'query_then_fetch' : 'count';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = angular.toJson(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
    esQuery = header + '\n' + esQuery + '\n';

    const url = this.getMultiSearchUrl();

    return this.post(url, esQuery).then((res: any) => {
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

  getMultiSearchUrl() {
    if (this.esVersion >= 70 && this.maxConcurrentShardRequests) {
      return `_msearch?max_concurrent_shard_requests=${this.maxConcurrentShardRequests}`;
    }

    return '_msearch';
  }

  metricFindQuery(query: any) {
    query = angular.fromJson(query);
    if (query) {
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

    return Promise.resolve([]);
  }

  getTagKeys() {
    return this.getFields({});
  }

  getTagValues(options: any) {
    return this.getTerms({ field: options.key, query: '*' });
  }

  targetContainsTemplate(target: any) {
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

  private isPrimitive(obj: any) {
    if (obj === null || obj === undefined) {
      return true;
    }
    if (['string', 'number', 'boolean'].some(type => type === typeof true)) {
      return true;
    }

    return false;
  }

  private objectContainsTemplate(obj: any) {
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

/**
 * Modifies dataframe and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame: DataFrame, dataLinks: DataLinkConfig[]) {
  if (dataLinks.length) {
    for (const field of dataFrame.fields) {
      const dataLinkConfig = dataLinks.find(dataLink => field.name && field.name.match(dataLink.field));
      if (dataLinkConfig) {
        let link: DataLink;
        if (dataLinkConfig.datasourceUid) {
          link = {
            title: '',
            url: '',
            internal: {
              query: { query: dataLinkConfig.url },
              datasourceUid: dataLinkConfig.datasourceUid,
            },
          };
        } else {
          link = {
            title: '',
            url: dataLinkConfig.url,
          };
        }
        field.config = field.config || {};
        field.config.links = [...(field.config.links || []), link];
      }
    }
  }
}
