import { cloneDeep, find, first as _first, isNumber, isObject, isString, map as _map } from 'lodash';
import { from, generate, lastValueFrom, Observable, of } from 'rxjs';
import { catchError, first, map, mergeMap, skipWhile, throwIfEmpty, tap } from 'rxjs/operators';
import { SemVer } from 'semver';

import {
  DataFrame,
  DataLink,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DataSourceWithQueryImportSupport,
  DataSourceWithSupplementaryQueriesSupport,
  DateTime,
  dateTime,
  getDefaultTimeRange,
  AbstractQuery,
  LogLevel,
  LogRowModel,
  MetricFindValue,
  ScopedVars,
  TimeRange,
  QueryFixAction,
  CoreApp,
  SupplementaryQueryType,
  DataQueryError,
  rangeUtil,
  LogRowContextQueryDirection,
  LogRowContextOptions,
  SupplementaryQueryOptions,
  toUtc,
  AnnotationEvent,
} from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv, config, BackendSrvRequest } from '@grafana/runtime';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { queryLogsSample, queryLogsVolume } from '../../../features/logs/logsModel';
import { getLogLevelFromKey } from '../../../features/logs/utils';

import { IndexPattern, intervalMap } from './IndexPattern';
import LanguageProvider from './LanguageProvider';
import { LegacyQueryRunner } from './LegacyQueryRunner';
import { ElasticQueryBuilder } from './QueryBuilder';
import { ElasticsearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import { isBucketAggregationWithField } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { isMetricAggregationWithMeta } from './guards';
import { addFilterToQuery, escapeFilter, queryHasFilter, removeFilterFromQuery } from './modifyQuery';
import { trackAnnotationQuery, trackQuery } from './tracking';
import {
  Logs,
  BucketAggregation,
  DataLinkConfig,
  ElasticsearchOptions,
  ElasticsearchQuery,
  TermsQuery,
  Interval,
  ElasticsearchAnnotationQuery,
  RangeMap,
} from './types';
import { getScriptValue, isSupportedVersion, isTimeSeriesQuery, unsupportedVersionMessage } from './utils';

export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';

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

export class ElasticDatasource
  extends DataSourceWithBackend<ElasticsearchQuery, ElasticsearchOptions>
  implements
    DataSourceWithLogsContextSupport,
    DataSourceWithQueryImportSupport<ElasticsearchQuery>,
    DataSourceWithSupplementaryQueriesSupport<ElasticsearchQuery>
{
  basicAuth?: string;
  withCredentials?: boolean;
  url: string;
  name: string;
  index: string;
  timeField: string;
  xpack: boolean;
  interval: string;
  maxConcurrentShardRequests?: number;
  queryBuilder: ElasticQueryBuilder;
  indexPattern: IndexPattern;
  intervalPattern?: Interval;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks: DataLinkConfig[];
  languageProvider: LanguageProvider;
  includeFrozen: boolean;
  isProxyAccess: boolean;
  timeSrv: TimeSrv;
  databaseVersion: SemVer | null;
  legacyQueryRunner: LegacyQueryRunner;

  constructor(
    instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url!;
    this.name = instanceSettings.name;
    this.isProxyAccess = instanceSettings.access === 'proxy';
    const settingsData = instanceSettings.jsonData || ({} as ElasticsearchOptions);

    this.index = settingsData.index ?? instanceSettings.database ?? '';
    this.timeField = settingsData.timeField;
    this.xpack = Boolean(settingsData.xpack);
    this.indexPattern = new IndexPattern(this.index, settingsData.interval);
    this.intervalPattern = settingsData.interval;
    this.interval = settingsData.timeInterval;
    this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
    });
    this.logMessageField = settingsData.logMessageField || '';
    this.logLevelField = settingsData.logLevelField || '';
    this.dataLinks = settingsData.dataLinks || [];
    this.includeFrozen = settingsData.includeFrozen ?? false;
    this.databaseVersion = null;
    this.annotations = {
      QueryEditor: ElasticsearchAnnotationsQueryEditor,
    };

    if (this.logMessageField === '') {
      this.logMessageField = undefined;
    }

    if (this.logLevelField === '') {
      this.logLevelField = undefined;
    }
    this.languageProvider = new LanguageProvider(this);
    this.timeSrv = getTimeSrv();
    this.legacyQueryRunner = new LegacyQueryRunner(this, this.templateSrv);
  }

  getResourceRequest(path: string, params?: BackendSrvRequest['params'], options?: Partial<BackendSrvRequest>) {
    return this.getResource(path, params, options);
  }

  postResourceRequest(path: string, data?: BackendSrvRequest['data'], options?: Partial<BackendSrvRequest>) {
    const resourceOptions = options ?? {};
    resourceOptions.headers = resourceOptions.headers ?? {};
    resourceOptions.headers['content-type'] = 'application/x-ndjson';

    return this.postResource(path, data, resourceOptions);
  }

  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<ElasticsearchQuery[]> {
    return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
  }

  /**
   * Sends a GET request to the specified url on the newest matching and available index.
   *
   * When multiple indices span the provided time range, the request is sent starting from the newest index,
   * and then going backwards until an index is found.
   *
   * @param url the url to query the index on, for example `/_mapping`.
   */

  private requestAllIndices(url: string, range = getDefaultTimeRange()): Observable<any> {
    let indexList = this.indexPattern.getIndexList(range.from, range.to);
    if (!Array.isArray(indexList)) {
      indexList = [this.indexPattern.getIndexForToday()];
    }

    const indexUrlList = indexList.map((index) => index + url);

    const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
    const listLen = indexUrlList.length;

    return generate({
      initialState: 0,
      condition: (i) => i < Math.min(listLen, maxTraversals),
      iterate: (i) => i + 1,
    }).pipe(
      mergeMap((index) => {
        // catch all errors and emit an object with an err property to simplify checks later in the pipeline
        const path = indexUrlList[listLen - index - 1];
        const requestObservable = config.featureToggles.enableElasticsearchBackendQuerying
          ? from(this.getResource(path))
          : this.legacyQueryRunner.request('GET', path);

        return requestObservable.pipe(catchError((err) => of({ err })));
      }),
      skipWhile((resp) => resp?.err?.status === 404), // skip all requests that fail because missing Elastic index
      throwIfEmpty(() => 'Could not find an available index for this time range.'), // when i === Math.min(listLen, maxTraversals) generate will complete but without emitting any values which means we didn't find a valid index
      first(), // take the first value that isn't skipped
      map((resp) => {
        if (resp.err) {
          throw resp.err; // if there is some other error except 404 then we must throw it
        }

        return resp;
      })
    );
  }

  annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const payload = this.prepareAnnotationRequest(options);
    trackAnnotationQuery(options.annotation);
    const annotationObservable = config.featureToggles.enableElasticsearchBackendQuerying
      ? // TODO: We should migrate this to use query and not resource call
        // The plan is to look at this when we start to work on raw query editor for ES
        // as we will have to explore how to handle any query
        from(this.postResourceRequest('_msearch', payload))
      : this.legacyQueryRunner.request('POST', '_msearch', payload);

    return lastValueFrom(
      annotationObservable.pipe(
        map((res) => {
          const hits = res.responses[0].hits.hits;
          return this.processHitsToAnnotationEvents(options.annotation, hits);
        })
      )
    );
  }

  private prepareAnnotationRequest(options: { annotation: ElasticsearchAnnotationQuery; range: TimeRange }) {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;

    // the `target.query` is the "new" location for the query.
    // normally we would write this code as
    // try-the-new-place-then-try-the-old-place,
    // but we had the bug at
    // https://github.com/grafana/grafana/issues/61107
    // that may have stored annotations where
    // both the old and the new place are set,
    // and in that scenario the old place needs
    // to have priority.
    const queryString = annotation.query ?? annotation.target?.query ?? '';

    const dateRanges = [];
    const rangeStart: RangeMap = {};
    rangeStart[timeField] = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      format: 'epoch_millis',
    };
    dateRanges.push({ range: rangeStart });

    if (timeEndField) {
      const rangeEnd: RangeMap = {};
      rangeEnd[timeEndField] = {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        format: 'epoch_millis',
      };
      dateRanges.push({ range: rangeEnd });
    }

    const queryInterpolated = this.interpolateLuceneQuery(queryString);
    const query: {
      bool: { filter: Array<Record<string, Record<string, string | number | Array<{ range: RangeMap }>>>> };
    } = {
      bool: {
        filter: [
          {
            bool: {
              should: dateRanges,
              minimum_should_match: 1,
            },
          },
        ],
      },
    };

    if (queryInterpolated) {
      query.bool.filter.push({
        query_string: {
          query: queryInterpolated,
        },
      });
    }
    const data = {
      query,
      size: 10000,
    };

    const header: Record<string, string | string[] | boolean> = {
      search_type: 'query_then_fetch',
      ignore_unavailable: true,
    };

    // @deprecated
    // Field annotation.index is deprecated and will be removed in the future
    if (annotation.index) {
      header.index = annotation.index;
    } else {
      header.index = this.indexPattern.getIndexList(options.range.from, options.range.to);
    }

    const payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';
    return payload;
  }

  private processHitsToAnnotationEvents(
    annotation: ElasticsearchAnnotationQuery,
    hits: Array<Record<string, string | number | Record<string | number, string | number>>>
  ) {
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const textField = annotation.textField || 'tags';
    const tagsField = annotation.tagsField || null;
    const list: AnnotationEvent[] = [];

    const getFieldFromSource = (source: any, fieldName: string | null) => {
      if (!fieldName) {
        return;
      }

      const fieldNames = fieldName.split('.');
      let fieldValue = source;

      for (let i = 0; i < fieldNames.length; i++) {
        fieldValue = fieldValue[fieldNames[i]];
        if (!fieldValue) {
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
        if (typeof fields === 'object' && (isString(fields[timeField]) || isNumber(fields[timeField]))) {
          time = fields[timeField];
        }
      }

      const event: AnnotationEvent = {
        annotation: annotation,
        time: toUtc(time).valueOf(),
        text: getFieldFromSource(source, textField),
      };

      if (timeEndField) {
        const timeEnd = getFieldFromSource(source, timeEndField);
        if (timeEnd) {
          event.timeEnd = toUtc(timeEnd).valueOf();
        }
      }

      // legacy support for title field
      if (annotation.titleField) {
        const title = getFieldFromSource(source, annotation.titleField);
        if (title) {
          event.text = title + '\n' + event.text;
        }
      }

      const tags = getFieldFromSource(source, tagsField);
      if (typeof tags === 'string') {
        event.tags = tags.split(',');
      } else {
        event.tags = tags;
      }

      list.push(event);
    }
    return list;
  }

  interpolateLuceneQuery(queryString: string, scopedVars?: ScopedVars) {
    return this.templateSrv.replace(queryString, scopedVars, 'lucene');
  }

  interpolateVariablesInQueries(queries: ElasticsearchQuery[], scopedVars: ScopedVars | {}): ElasticsearchQuery[] {
    return queries.map((q) => this.applyTemplateVariables(q, scopedVars));
  }

  async testDatasource() {
    // we explicitly ask for uncached, "fresh" data here
    const dbVersion = await this.getDatabaseVersion(false);
    // if we are not able to determine the elastic-version, we assume it is a good version.
    const isSupported = dbVersion != null ? isSupportedVersion(dbVersion) : true;
    const versionMessage = isSupported ? '' : `WARNING: ${unsupportedVersionMessage} `;
    // validate that the index exist and has date field
    return lastValueFrom(
      this.getFields(['date']).pipe(
        mergeMap((dateFields) => {
          const timeField = find(dateFields, { text: this.timeField });
          if (!timeField) {
            return of({
              status: 'error',
              message: 'No date field named ' + this.timeField + ' found',
            });
          }
          return of({ status: 'success', message: `${versionMessage}Data source successfully connected.` });
        }),
        catchError((err) => {
          const infoInParentheses = err.message ? ` (${err.message})` : '';
          const message = `Unable to connect with Elasticsearch${infoInParentheses}. Please check the server logs for more details.`;
          return of({ status: 'error', message });
        })
      )
    );
  }

  getQueryHeader(searchType: string, timeFrom?: DateTime, timeTo?: DateTime): string {
    const queryHeader = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };

    return JSON.stringify(queryHeader);
  }

  getQueryDisplayText(query: ElasticsearchQuery) {
    // TODO: This might be refactored a bit.
    const metricAggs = query.metrics;
    const bucketAggs = query.bucketAggs;
    let text = '';

    if (query.query) {
      text += 'Query: ' + query.query + ', ';
    }

    text += 'Metrics: ';

    text += metricAggs?.reduce((acc, metric) => {
      const metricConfig = metricAggregationConfig[metric.type];

      let text = metricConfig.label + '(';

      if (isMetricAggregationWithField(metric)) {
        text += metric.field;
      }
      if (isPipelineAggregationWithMultipleBucketPaths(metric)) {
        text += getScriptValue(metric).replace(new RegExp('params.', 'g'), '');
      }
      text += '), ';

      return `${acc} ${text}`;
    }, '');

    text += bucketAggs?.reduce((acc, bucketAgg, index) => {
      const bucketConfig = bucketAggregationConfig[bucketAgg.type];

      let text = '';
      if (index === 0) {
        text += ' Group by: ';
      }

      text += bucketConfig.label + '(';
      if (isBucketAggregationWithField(bucketAgg)) {
        text += bucketAgg.field;
      }

      return `${acc} ${text}), `;
    }, '');

    if (query.alias) {
      text += 'Alias: ' + query.alias;
    }

    return text;
  }

  showContextToggle(): boolean {
    return true;
  }

  getLogRowContext = async (row: LogRowModel, options?: LogRowContextOptions): Promise<{ data: DataFrame[] }> => {
    const { enableElasticsearchBackendQuerying } = config.featureToggles;
    if (enableElasticsearchBackendQuerying) {
      const contextRequest = this.makeLogContextDataRequest(row, options);

      return lastValueFrom(
        this.query(contextRequest).pipe(
          catchError((err) => {
            const error: DataQueryError = {
              message: 'Error during context query. Please check JS console logs.',
              status: err.status,
              statusText: err.statusText,
            };
            throw error;
          })
        )
      );
    } else {
      return this.legacyQueryRunner.logContextQuery(row, options);
    }
  };

  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<ElasticsearchQuery>
  ): Observable<DataQueryResponse> | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }
    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeDataProvider(request);
      case SupplementaryQueryType.LogsSample:
        return this.getLogsSampleDataProvider(request);
      default:
        return undefined;
    }
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
  }

  getSupplementaryQuery(options: SupplementaryQueryOptions, query: ElasticsearchQuery): ElasticsearchQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(options.type)) {
      return undefined;
    }

    let isQuerySuitable = false;

    switch (options.type) {
      case SupplementaryQueryType.LogsVolume:
        // it has to be a logs-producing range-query
        isQuerySuitable = !!(query.metrics?.length === 1 && query.metrics[0].type === 'logs');
        if (!isQuerySuitable) {
          return undefined;
        }
        const bucketAggs: BucketAggregation[] = [];
        const timeField = this.timeField ?? '@timestamp';

        if (this.logLevelField) {
          bucketAggs.push({
            id: '2',
            type: 'terms',
            settings: {
              min_doc_count: '0',
              size: '0',
              order: 'desc',
              orderBy: '_count',
              missing: LogLevel.unknown,
            },
            field: this.logLevelField,
          });
        }
        bucketAggs.push({
          id: '3',
          type: 'date_histogram',
          settings: {
            interval: 'auto',
            min_doc_count: '0',
            trimEdges: '0',
          },
          field: timeField,
        });

        return {
          refId: `${REF_ID_STARTER_LOG_VOLUME}${query.refId}`,
          query: query.query,
          metrics: [{ type: 'count', id: '1' }],
          timeField,
          bucketAggs,
        };

      case SupplementaryQueryType.LogsSample:
        isQuerySuitable = isTimeSeriesQuery(query);

        if (!isQuerySuitable) {
          return undefined;
        }

        if (options.limit) {
          return {
            refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
            query: query.query,
            metrics: [{ type: 'logs', id: '1', settings: { limit: options.limit.toString() } }],
          };
        }

        return {
          refId: `${REF_ID_STARTER_LOG_SAMPLE}${query.refId}`,
          query: query.query,
          metrics: [{ type: 'logs', id: '1' }],
        };

      default:
        return undefined;
    }
  }

  getLogsVolumeDataProvider(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, target))
      .filter((query): query is ElasticsearchQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return queryLogsVolume(
      this,
      { ...logsVolumeRequest, targets },
      {
        range: request.range,
        targets: request.targets,
        extractLevel: (dataFrame) => getLogLevelFromKey(dataFrame.name || ''),
      }
    );
  }

  getLogsSampleDataProvider(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> | undefined {
    const logsSampleRequest = cloneDeep(request);
    const targets = logsSampleRequest.targets;
    const queries = targets.map((query) => {
      return this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, query);
    });
    const elasticQueries = queries.filter((query): query is ElasticsearchQuery => !!query);

    if (!elasticQueries.length) {
      return undefined;
    }
    return queryLogsSample(this, { ...logsSampleRequest, targets: elasticQueries });
  }

  query(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> {
    const { enableElasticsearchBackendQuerying } = config.featureToggles;
    if (enableElasticsearchBackendQuerying) {
      const start = new Date();
      return super.query(request).pipe(
        tap((response) => trackQuery(response, request, start)),
        map((response) => {
          response.data.forEach((dataFrame) => {
            enhanceDataFrameWithDataLinks(dataFrame, this.dataLinks);
          });
          return response;
        })
      );
    }
    return this.legacyQueryRunner.query(request);
  }

  filterQuery(query: ElasticsearchQuery): boolean {
    if (query.hide) {
      return false;
    }
    return true;
  }

  isMetadataField(fieldName: string) {
    return ELASTIC_META_FIELDS.includes(fieldName);
  }

  // TODO: instead of being a string, this could be a custom type representing all the elastic types
  // FIXME: This doesn't seem to return actual MetricFindValues, we should either change the return type
  // or fix the implementation.
  getFields(type?: string[], range?: TimeRange): Observable<MetricFindValue[]> {
    const typeMap: Record<string, string> = {
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
      histogram: 'number',
    };
    return this.requestAllIndices('/_mapping', range).pipe(
      map((result) => {
        const shouldAddField = (obj: any, key: string) => {
          if (this.isMetadataField(key)) {
            return false;
          }

          if (!type || type.length === 0) {
            return true;
          }

          // equal query type filter, or via type map translation
          return type.includes(obj.type) || type.includes(typeMap[obj.type]);
        };

        // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
        const fieldNameParts: string[] = [];
        const fields: Record<string, { text: string; type: string }> = {};

        function getFieldsRecursively(obj: any) {
          for (const key in obj) {
            const subObj = obj[key];

            // Check mapping field for nested fields
            if (isObject(subObj.properties)) {
              fieldNameParts.push(key);
              getFieldsRecursively(subObj.properties);
            }

            if (isObject(subObj.fields)) {
              fieldNameParts.push(key);
              getFieldsRecursively(subObj.fields);
            }

            if (isString(subObj.type)) {
              const fieldName = fieldNameParts.concat(key).join('.');

              // Hide meta-fields and check field type
              if (shouldAddField(subObj, key)) {
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

            const properties = mappings.properties;
            getFieldsRecursively(properties);
          }
        }

        // transform to array
        return _map(fields, (value) => {
          return value;
        });
      })
    );
  }

  getTerms(queryDef: TermsQuery, range = getDefaultTimeRange()): Observable<MetricFindValue[]> {
    const searchType = 'query_then_fetch';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
    esQuery = header + '\n' + esQuery + '\n';

    const url = this.getMultiSearchUrl();

    const termsObservable = config.featureToggles.enableElasticsearchBackendQuerying
      ? // TODO: This is run through resource call, but maybe should run through query
        from(this.postResourceRequest(url, esQuery))
      : this.legacyQueryRunner.request('POST', url, esQuery);

    return termsObservable.pipe(
      map((res) => {
        if (!res.responses[0].aggregations) {
          return [];
        }

        const buckets = res.responses[0].aggregations['1'].buckets;
        return _map(buckets, (bucket) => {
          return {
            text: bucket.key_as_string || bucket.key,
            value: bucket.key,
          };
        });
      })
    );
  }

  getMultiSearchUrl() {
    const searchParams = new URLSearchParams();

    if (this.maxConcurrentShardRequests) {
      searchParams.append('max_concurrent_shard_requests', `${this.maxConcurrentShardRequests}`);
    }

    if (this.xpack && this.includeFrozen) {
      searchParams.append('ignore_throttled', 'false');
    }

    return ('_msearch?' + searchParams.toString()).replace(/\?$/, '');
  }

  metricFindQuery(query: string, options?: { range: TimeRange }): Promise<MetricFindValue[]> {
    const range = options?.range;
    const parsedQuery = JSON.parse(query);
    if (query) {
      if (parsedQuery.find === 'fields') {
        parsedQuery.type = this.interpolateLuceneQuery(parsedQuery.type);
        return lastValueFrom(this.getFields(parsedQuery.type, range));
      }

      if (parsedQuery.find === 'terms') {
        parsedQuery.field = this.interpolateLuceneQuery(parsedQuery.field);
        parsedQuery.query = this.interpolateLuceneQuery(parsedQuery.query);
        return lastValueFrom(this.getTerms(parsedQuery, range));
      }
    }

    return Promise.resolve([]);
  }

  getTagKeys() {
    return lastValueFrom(this.getFields());
  }

  getTagValues(options: { key: string }) {
    const range = this.timeSrv.timeRange();
    return lastValueFrom(this.getTerms({ field: options.key }, range));
  }

  targetContainsTemplate(target: ElasticsearchQuery) {
    if (this.templateSrv.containsTemplate(target.query) || this.templateSrv.containsTemplate(target.alias)) {
      return true;
    }

    if (target.bucketAggs) {
      for (const bucketAgg of target.bucketAggs) {
        if (isBucketAggregationWithField(bucketAgg) && this.templateSrv.containsTemplate(bucketAgg.field)) {
          return true;
        }
        if (this.objectContainsTemplate(bucketAgg.settings)) {
          return true;
        }
      }
    }

    if (target.metrics) {
      for (const metric of target.metrics) {
        if (!isMetricAggregationWithField(metric)) {
          continue;
        }
        if (metric.field && this.templateSrv.containsTemplate(metric.field)) {
          return true;
        }
        if (metric.settings && this.objectContainsTemplate(metric.settings)) {
          return true;
        }
        if (isMetricAggregationWithMeta(metric) && this.objectContainsTemplate(metric.meta)) {
          return true;
        }
      }
    }

    return false;
  }

  private objectContainsTemplate(obj: any) {
    if (typeof obj === 'string') {
      return this.templateSrv.containsTemplate(obj);
    }
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          if (this.objectContainsTemplate(item)) {
            return true;
          }
        }
      } else if (this.objectContainsTemplate(obj[key])) {
        return true;
      }
    }

    return false;
  }

  modifyQuery(query: ElasticsearchQuery, action: QueryFixAction): ElasticsearchQuery {
    if (!action.options) {
      return query;
    }

    let expression = query.query ?? '';
    if (config.featureToggles.elasticToggleableFilters) {
      switch (action.type) {
        case 'ADD_FILTER': {
          // This gives the user the ability to toggle a filter on and off.
          expression = queryHasFilter(expression, action.options.key, action.options.value)
            ? removeFilterFromQuery(expression, action.options.key, action.options.value)
            : addFilterToQuery(expression, action.options.key, action.options.value);
          break;
        }
        case 'ADD_FILTER_OUT': {
          // If the opposite filter is present, remove it before adding the new one.
          if (queryHasFilter(expression, action.options.key, action.options.value)) {
            expression = removeFilterFromQuery(expression, action.options.key, action.options.value);
          }
          expression = addFilterToQuery(expression, action.options.key, action.options.value, '-');
          break;
        }
      }
    } else {
      // Legacy behavior
      switch (action.type) {
        case 'ADD_FILTER': {
          expression = addFilterToQuery(expression, action.options.key, action.options.value);
          break;
        }
        case 'ADD_FILTER_OUT': {
          expression = addFilterToQuery(expression, action.options.key, action.options.value, '-');
          break;
        }
      }
    }

    return { ...query, query: expression };
  }

  addAdHocFilters(query: string) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    if (adhocFilters.length === 0) {
      return query;
    }
    const esFilters = adhocFilters.map((filter) => {
      let { key, operator, value } = filter;
      if (!key || !value) {
        return;
      }
      /**
       * Keys and values in ad hoc filters may contain characters such as
       * colons, which needs to be escaped.
       */
      key = escapeFilter(key);
      switch (operator) {
        case '=':
          return `${key}:"${value}"`;
        case '!=':
          return `-${key}:"${value}"`;
        case '=~':
          return `${key}:/${value}/`;
        case '!~':
          return `-${key}:/${value}/`;
        case '>':
          return `${key}:>${value}`;
        case '<':
          return `${key}:<${value}`;
      }
      return;
    });

    const finalQuery = [query, ...esFilters].filter((f) => f).join(' AND ');
    return finalQuery;
  }

  // Used when running queries through backend
  applyTemplateVariables(query: ElasticsearchQuery, scopedVars: ScopedVars): ElasticsearchQuery {
    // We need a separate interpolation format for lucene queries, therefore we first interpolate any
    // lucene query string and then everything else
    const interpolateBucketAgg = (bucketAgg: BucketAggregation): BucketAggregation => {
      if (bucketAgg.type === 'filters') {
        return {
          ...bucketAgg,
          settings: {
            ...bucketAgg.settings,
            filters: bucketAgg.settings?.filters?.map((filter) => ({
              ...filter,
              query: this.interpolateLuceneQuery(filter.query, scopedVars) || '*',
            })),
          },
        };
      }

      return bucketAgg;
    };

    const expandedQuery = {
      ...query,
      datasource: this.getRef(),
      query: this.addAdHocFilters(this.interpolateLuceneQuery(query.query || '', scopedVars)),
      bucketAggs: query.bucketAggs?.map(interpolateBucketAgg),
    };

    const finalQuery = JSON.parse(this.templateSrv.replace(JSON.stringify(expandedQuery), scopedVars));
    return finalQuery;
  }

  private getDatabaseVersionUncached(): Promise<SemVer | null> {
    // we want this function to never fail
    const getDbVersionObservable = config.featureToggles.enableElasticsearchBackendQuerying
      ? from(this.getResourceRequest(''))
      : this.legacyQueryRunner.request('GET', '/');

    return lastValueFrom(getDbVersionObservable).then(
      (data) => {
        const versionNumber = data?.version?.number;
        if (typeof versionNumber !== 'string') {
          return null;
        }
        try {
          return new SemVer(versionNumber);
        } catch (error) {
          console.error(error);
          return null;
        }
      },
      (error) => {
        console.error(error);
        return null;
      }
    );
  }

  async getDatabaseVersion(useCachedData = true): Promise<SemVer | null> {
    if (useCachedData) {
      const cached = this.databaseVersion;
      if (cached != null) {
        return cached;
      }
    }

    const freshDatabaseVersion = await this.getDatabaseVersionUncached();
    this.databaseVersion = freshDatabaseVersion;
    return freshDatabaseVersion;
  }

  private makeLogContextDataRequest = (row: LogRowModel, options?: LogRowContextOptions) => {
    const direction = options?.direction || LogRowContextQueryDirection.Backward;
    const logQuery: Logs = {
      type: 'logs',
      id: '1',
      settings: {
        limit: options?.limit ? options?.limit.toString() : '10',
        // Sorting of results in the context query
        sortDirection: direction === LogRowContextQueryDirection.Backward ? 'desc' : 'asc',
        // Used to get the next log lines before/after the current log line using sort field of selected log line
        searchAfter: row.dataFrame.fields.find((f) => f.name === 'sort')?.values[row.rowIndex] ?? [row.timeEpochMs],
      },
    };

    const query: ElasticsearchQuery = {
      refId: `log-context-${row.dataFrame.refId}-${direction}`,
      metrics: [logQuery],
      query: '',
    };

    const timeRange = createContextTimeRange(row.timeEpochMs, direction, this.intervalPattern);
    const range = {
      from: timeRange.from,
      to: timeRange.to,
      raw: timeRange,
    };

    const interval = rangeUtil.calculateInterval(range, 1);

    const contextRequest: DataQueryRequest<ElasticsearchQuery> = {
      requestId: `log-context-request-${row.dataFrame.refId}-${options?.direction}`,
      targets: [query],
      interval: interval.interval,
      intervalMs: interval.intervalMs,
      range,
      scopedVars: {},
      timezone: 'UTC',
      app: CoreApp.Explore,
      startTime: Date.now(),
      hideFromInspector: true,
    };
    return contextRequest;
  };
}

export function enhanceDataFrameWithDataLinks(dataFrame: DataFrame, dataLinks: DataLinkConfig[]) {
  if (!dataLinks.length) {
    return;
  }

  for (const field of dataFrame.fields) {
    const linksToApply = dataLinks.filter((dataLink) => new RegExp(dataLink.field).test(field.name));

    if (linksToApply.length === 0) {
      continue;
    }

    field.config = field.config || {};
    field.config.links = [...(field.config.links || [], linksToApply.map(generateDataLink))];
  }
}

function generateDataLink(linkConfig: DataLinkConfig): DataLink {
  const dataSourceSrv = getDataSourceSrv();

  if (linkConfig.datasourceUid) {
    const dsSettings = dataSourceSrv.getInstanceSettings(linkConfig.datasourceUid);

    return {
      title: linkConfig.urlDisplayLabel || '',
      url: '',
      internal: {
        query: { query: linkConfig.url },
        datasourceUid: linkConfig.datasourceUid,
        datasourceName: dsSettings?.name ?? 'Data source not found',
      },
    };
  } else {
    return {
      title: linkConfig.urlDisplayLabel || '',
      url: linkConfig.url,
    };
  }
}

function createContextTimeRange(rowTimeEpochMs: number, direction: string, intervalPattern: Interval | undefined) {
  const offset = 7;
  // For log context, we want to request data from 7 subsequent/previous indices
  if (intervalPattern) {
    const intervalInfo = intervalMap[intervalPattern];
    if (direction === LogRowContextQueryDirection.Forward) {
      return {
        from: dateTime(rowTimeEpochMs).utc(),
        to: dateTime(rowTimeEpochMs).add(offset, intervalInfo.amount).utc().startOf(intervalInfo.startOf),
      };
    } else {
      return {
        from: dateTime(rowTimeEpochMs).subtract(offset, intervalInfo.amount).utc().startOf(intervalInfo.startOf),
        to: dateTime(rowTimeEpochMs).utc(),
      };
    }
    // If we don't have an interval pattern, we can't do this, so we just request data from 7h before/after
  } else {
    if (direction === LogRowContextQueryDirection.Forward) {
      return {
        from: dateTime(rowTimeEpochMs).utc(),
        to: dateTime(rowTimeEpochMs).add(offset, 'hours').utc(),
      };
    } else {
      return {
        from: dateTime(rowTimeEpochMs).subtract(offset, 'hours').utc(),
        to: dateTime(rowTimeEpochMs).utc(),
      };
    }
  }
}
