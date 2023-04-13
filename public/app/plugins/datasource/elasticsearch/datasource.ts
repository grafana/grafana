import { cloneDeep, find, first as _first, isNumber, isObject, isString, map as _map } from 'lodash';
import { generate, lastValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, first, map, mergeMap, skipWhile, throwIfEmpty, tap, switchMap } from 'rxjs/operators';
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
  toUtc,
  QueryFixAction,
  CoreApp,
  SupplementaryQueryType,
  DataQueryError,
  FieldCache,
  FieldType,
  rangeUtil,
  Field,
  sortDataFrame,
} from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getBackendSrv, getDataSourceSrv, config } from '@grafana/runtime';
import { queryLogsVolume } from 'app/core/logsModel';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { RowContextOptions } from '../../../features/logs/components/log-context/types';
import { getLogLevelFromKey } from '../../../features/logs/utils';

import { ElasticResponse } from './ElasticResponse';
import { IndexPattern, intervalMap } from './IndexPattern';
import LanguageProvider from './LanguageProvider';
import { ElasticQueryBuilder } from './QueryBuilder';
import { ElasticsearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import { isBucketAggregationWithField } from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { defaultBucketAgg, hasMetricOfType } from './queryDef';
import { trackQuery } from './tracking';
import {
  Logs,
  BucketAggregation,
  DataLinkConfig,
  ElasticsearchOptions,
  ElasticsearchQuery,
  TermsQuery,
  Interval,
} from './types';
import { getScriptValue, isSupportedVersion, unsupportedVersionMessage } from './utils';

export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
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

  constructor(
    instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.url = instanceSettings.url!;
    this.name = instanceSettings.name;
    this.index = instanceSettings.database ?? '';
    this.isProxyAccess = instanceSettings.access === 'proxy';
    const settingsData = instanceSettings.jsonData || ({} as ElasticsearchOptions);

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
  }

  private request(
    method: string,
    url: string,
    data?: undefined,
    headers?: BackendSrvRequest['headers']
  ): Observable<any> {
    if (!this.isProxyAccess) {
      const error = new Error(
        'Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.'
      );
      return throwError(() => error);
    }

    const options: BackendSrvRequest = {
      url: this.url + '/' + url,
      method,
      data,
      headers,
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
      .fetch<any>(options)
      .pipe(
        map((results) => {
          results.data.$$config = results.config;
          return results.data;
        }),
        catchError((err) => {
          if (err.data) {
            const message = err.data.error?.reason ?? err.data.message ?? 'Unknown error';

            return throwError({
              message: 'Elasticsearch error: ' + message,
              error: err.data.error,
            });
          }

          return throwError(err);
        })
      );
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
  private get(url: string, range = getDefaultTimeRange()): Observable<any> {
    let indexList = this.indexPattern.getIndexList(range.from, range.to);
    if (!Array.isArray(indexList)) {
      indexList = [this.indexPattern.getIndexForToday()];
    }

    const indexUrlList = indexList.map((index) => index + url);

    return this.requestAllIndices(indexUrlList);
  }

  private requestAllIndices(indexList: string[]): Observable<any> {
    const maxTraversals = 7; // do not go beyond one week (for a daily pattern)
    const listLen = indexList.length;

    return generate({
      initialState: 0,
      condition: (i) => i < Math.min(listLen, maxTraversals),
      iterate: (i) => i + 1,
    }).pipe(
      mergeMap((index) => {
        // catch all errors and emit an object with an err property to simplify checks later in the pipeline
        return this.request('GET', indexList[listLen - index - 1]).pipe(catchError((err) => of({ err })));
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

  private post(url: string, data: any): Observable<any> {
    return this.request('POST', url, data, { 'Content-Type': 'application/x-ndjson' });
  }

  annotationQuery(options: any): Promise<any> {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const queryString = annotation.query;
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

    const queryInterpolated = this.interpolateLuceneQuery(queryString);
    const query: any = {
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
    const data: any = {
      query,
      size: 10000,
    };

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

    const payload = JSON.stringify(header) + '\n' + JSON.stringify(data) + '\n';

    return lastValueFrom(
      this.post('_msearch', payload).pipe(
        map((res) => {
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
              if (isString(fields[timeField]) || isNumber(fields[timeField])) {
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
        })
      )
    );
  }

  private interpolateLuceneQuery(queryString: string, scopedVars?: ScopedVars) {
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
          const timeField: any = find(dateFields, { text: this.timeField });
          if (!timeField) {
            return of({
              status: 'error',
              message: 'No date field named ' + this.timeField + ' found',
            });
          }
          return of({ status: 'success', message: `${versionMessage}Index OK. Time field name OK` });
        }),
        catchError((err) => {
          console.error(err);
          if (err.message) {
            return of({ status: 'error', message: err.message });
          } else {
            return of({ status: 'error', message: err.status });
          }
        })
      )
    );
  }

  getQueryHeader(searchType: any, timeFrom?: DateTime, timeTo?: DateTime): string {
    const queryHeader: any = {
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

  getLogRowContext = async (row: LogRowModel, options?: RowContextOptions): Promise<{ data: DataFrame[] }> => {
    const { disableElasticsearchBackendQuerying } = config.featureToggles;
    if (!disableElasticsearchBackendQuerying) {
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
          }),
          switchMap((res) => {
            return of(processToLogContextDataFrames(res));
          })
        )
      );
    } else {
      const sortField = row.dataFrame.fields.find((f) => f.name === 'sort');
      const searchAfter = sortField?.values.get(row.rowIndex) || [row.timeEpochMs];
      const sort = options?.direction === 'FORWARD' ? 'asc' : 'desc';

      const header =
        options?.direction === 'FORWARD'
          ? this.getQueryHeader('query_then_fetch', dateTime(row.timeEpochMs))
          : this.getQueryHeader('query_then_fetch', undefined, dateTime(row.timeEpochMs));

      const limit = options?.limit ?? 10;
      const esQuery = JSON.stringify({
        size: limit,
        query: {
          bool: {
            filter: [
              {
                range: {
                  [this.timeField]: {
                    [options?.direction === 'FORWARD' ? 'gte' : 'lte']: row.timeEpochMs,
                    format: 'epoch_millis',
                  },
                },
              },
            ],
          },
        },
        sort: [{ [this.timeField]: sort }, { _doc: sort }],
        search_after: searchAfter,
      });
      const payload = [header, esQuery].join('\n') + '\n';
      const url = this.getMultiSearchUrl();
      const response = await lastValueFrom(this.post(url, payload));
      const targets: ElasticsearchQuery[] = [{ refId: `${row.dataFrame.refId}`, metrics: [{ type: 'logs', id: '1' }] }];
      const elasticResponse = new ElasticResponse(targets, transformHitsBasedOnDirection(response, sort));
      const logResponse = elasticResponse.getLogs(this.logMessageField, this.logLevelField);
      const dataFrame = _first(logResponse.data);
      if (!dataFrame) {
        return { data: [] };
      }
      /**
       * The LogRowContext requires there is a field in the dataFrame.fields
       * named `ts` for timestamp and `line` for the actual log line to display.
       * Unfortunatly these fields are hardcoded and are required for the lines to
       * be properly displayed. This code just copies the fields based on this.timeField
       * and this.logMessageField and recreates the dataFrame so it works.
       */
      const timestampField = dataFrame.fields.find((f: Field) => f.name === this.timeField);
      const lineField = dataFrame.fields.find((f: Field) => f.name === this.logMessageField);
      if (timestampField && lineField) {
        return {
          data: [
            {
              ...dataFrame,
              fields: [...dataFrame.fields, { ...timestampField, name: 'ts' }, { ...lineField, name: 'line' }],
            },
          ],
        };
      }
      return logResponse;
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
      default:
        return undefined;
    }
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }

  getSupplementaryQuery(type: SupplementaryQueryType, query: ElasticsearchQuery): ElasticsearchQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }

    let isQuerySuitable = false;

    switch (type) {
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

      default:
        return undefined;
    }
  }

  getLogsVolumeDataProvider(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((target) => this.getSupplementaryQuery(SupplementaryQueryType.LogsVolume, target))
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

  query(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> {
    const { disableElasticsearchBackendQuerying } = config.featureToggles;
    if (!disableElasticsearchBackendQuerying) {
      const start = new Date();
      return super.query(request).pipe(tap((response) => trackQuery(response, request, start)));
    }
    let payload = '';
    const targets = this.interpolateVariablesInQueries(cloneDeep(request.targets), request.scopedVars);
    const sentTargets: ElasticsearchQuery[] = [];
    let targetsContainsLogsQuery = targets.some((target) => hasMetricOfType(target, 'logs'));

    const logLimits: Array<number | undefined> = [];

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      let queryObj;
      if (hasMetricOfType(target, 'logs')) {
        // FIXME: All this logic here should be in the query builder.
        // When moving to the BE-only implementation we should remove this and let the BE
        // Handle this.
        // TODO: defaultBucketAgg creates a dete_histogram aggregation without a field, so it fallbacks to
        // the configured timeField. we should allow people to use a different time field here.
        target.bucketAggs = [defaultBucketAgg()];

        const log = target.metrics?.find((m) => m.type === 'logs') as Logs;
        const limit = log.settings?.limit ? parseInt(log.settings?.limit, 10) : 500;
        logLimits.push(limit);

        target.metrics = [];
        // Setting this for metrics queries that are typed as logs
        queryObj = this.queryBuilder.getLogsQuery(target, limit);
      } else {
        logLimits.push();
        if (target.alias) {
          target.alias = this.interpolateLuceneQuery(target.alias, request.scopedVars);
        }

        queryObj = this.queryBuilder.build(target);
      }

      const esQuery = JSON.stringify(queryObj);

      const searchType = 'query_then_fetch';
      const header = this.getQueryHeader(searchType, request.range.from, request.range.to);
      payload += header + '\n';

      payload += esQuery + '\n';

      sentTargets.push(target);
    }

    if (sentTargets.length === 0) {
      return of({ data: [] });
    }

    // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
    // it as an integer not as string with digits. This is because elastic will convert the string only if the time
    // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
    // and then sending string will error out.
    payload = payload.replace(/"\$timeFrom"/g, request.range.from.valueOf().toString());
    payload = payload.replace(/"\$timeTo"/g, request.range.to.valueOf().toString());
    payload = this.templateSrv.replace(payload, request.scopedVars);

    const url = this.getMultiSearchUrl();

    const start = new Date();
    return this.post(url, payload).pipe(
      map((res) => {
        const er = new ElasticResponse(sentTargets, res);

        // TODO: This needs to be revisited, it seems wrong to process ALL the sent queries as logs if only one of them was a log query
        if (targetsContainsLogsQuery) {
          const response = er.getLogs(this.logMessageField, this.logLevelField);

          response.data.forEach((dataFrame, index) => {
            enhanceDataFrame(dataFrame, this.dataLinks, logLimits[index]);
          });
          return response;
        }

        return er.getTimeSeries();
      }),
      tap((response) => trackQuery(response, request, start))
    );
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
    return this.get('/_mapping', range).pipe(
      map((result) => {
        const shouldAddField = (obj: any, key: string) => {
          if (this.isMetadataField(key)) {
            return false;
          }

          if (!type || type.length === 0) {
            return true;
          }

          // equal query type filter, or via typemap translation
          return type.includes(obj.type) || type.includes(typeMap[obj.type]);
        };

        // Store subfield names: [system, process, cpu, total] -> system.process.cpu.total
        const fieldNameParts: any = [];
        const fields: any = {};

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

    return this.post(url, esQuery).pipe(
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

  metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
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

  getTagValues(options: any) {
    const range = this.timeSrv.timeRange();
    return lastValueFrom(this.getTerms({ field: options.key }, range));
  }

  targetContainsTemplate(target: any) {
    if (this.templateSrv.containsTemplate(target.query) || this.templateSrv.containsTemplate(target.alias)) {
      return true;
    }

    for (const bucketAgg of target.bucketAggs) {
      if (this.templateSrv.containsTemplate(bucketAgg.field) || this.objectContainsTemplate(bucketAgg.settings)) {
        return true;
      }
    }

    for (const metric of target.metrics) {
      if (
        this.templateSrv.containsTemplate(metric.field) ||
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
    if (['string', 'number', 'boolean'].some((type) => type === typeof true)) {
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
        if (this.templateSrv.containsTemplate(obj[key])) {
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

  modifyQuery(query: ElasticsearchQuery, action: QueryFixAction): ElasticsearchQuery {
    if (!action.options) {
      return query;
    }

    let expression = query.query ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        if (expression.length > 0) {
          expression += ' AND ';
        }
        expression += `${action.options.key}:"${action.options.value}"`;
        break;
      }
      case 'ADD_FILTER_OUT': {
        if (expression.length > 0) {
          expression += ' AND ';
        }
        expression += `-${action.options.key}:"${action.options.value}"`;
        break;
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
      const { key, operator, value } = filter;
      if (!key || !value) {
        return;
      }
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
    return lastValueFrom(this.request('GET', '/')).then(
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

  private makeLogContextDataRequest = (row: LogRowModel, options?: RowContextOptions) => {
    const direction = options?.direction || 'BACKWARD';
    const logQuery: Logs = {
      type: 'logs',
      id: '1',
      settings: {
        limit: options?.limit ? options?.limit.toString() : '10',
        // Sorting of results in the context query
        sortDirection: direction === 'BACKWARD' ? 'desc' : 'asc',
        // Used to get the next log lines before/after the current log line using sort field of selected log line
        searchAfter: row.dataFrame.fields.find((f) => f.name === 'sort')?.values.get(row.rowIndex) ?? [row.timeEpochMs],
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

/**
 * Modifies dataframe and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame: DataFrame, dataLinks: DataLinkConfig[], limit?: number) {
  if (limit) {
    dataFrame.meta = {
      ...dataFrame.meta,
      limit,
    };
  }

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
function transformHitsBasedOnDirection(response: any, direction: 'asc' | 'desc') {
  if (direction === 'desc') {
    return response;
  }
  const actualResponse = response.responses[0];
  return {
    ...response,
    responses: [
      {
        ...actualResponse,
        hits: {
          ...actualResponse.hits,
          hits: actualResponse.hits.hits.reverse(),
        },
      },
    ],
  };
}

function processToLogContextDataFrames(result: DataQueryResponse): DataQueryResponse {
  const frames = result.data.map((frame) => sortDataFrame(frame, 0, true));
  const processedFrames = frames.map((frame) => {
    // log-row-context requires specific field-names to work, so we set them here: "ts", "line", "id"
    const cache = new FieldCache(frame);
    const timestampField = cache.getFirstFieldOfType(FieldType.time);
    const lineField = cache.getFirstFieldOfType(FieldType.string);
    const idField = cache.getFieldByName('_id');

    if (!timestampField || !lineField || !idField) {
      return { ...frame, fields: [] };
    }

    return {
      ...frame,
      fields: [
        {
          ...timestampField,
          name: 'ts',
        },
        {
          ...lineField,
          name: 'line',
        },
        {
          ...idField,
          name: 'id',
        },
      ],
    };
  });

  return {
    ...result,
    data: processedFrames,
  };
}

function createContextTimeRange(rowTimeEpochMs: number, direction: string, intervalPattern: Interval | undefined) {
  const offset = 7;
  // For log context, we want to request data from 7 subsequent/previous indices
  if (intervalPattern) {
    const intervalInfo = intervalMap[intervalPattern];
    if (direction === 'FORWARD') {
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
    if (direction === 'FORWARD') {
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
