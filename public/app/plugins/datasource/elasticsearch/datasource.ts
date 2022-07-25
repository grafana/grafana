import { cloneDeep, find, first as _first, isNumber, isObject, isString, map as _map } from 'lodash';
import { generate, lastValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, first, map, mergeMap, skipWhile, throwIfEmpty } from 'rxjs/operators';
import { gte, lt, satisfies } from 'semver';

import {
  DataFrame,
  DataLink,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DataSourceWithQueryImportSupport,
  DataSourceWithLogsVolumeSupport,
  DateTime,
  dateTime,
  Field,
  getDefaultTimeRange,
  AbstractQuery,
  getLogLevelFromKey,
  LogLevel,
  LogRowModel,
  MetricFindValue,
  ScopedVars,
  TimeRange,
  toUtc,
  QueryFixAction,
} from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import { queryLogsVolume } from 'app/core/logsModel';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { ElasticsearchAnnotationsQueryEditor } from './components/QueryEditor/AnnotationQueryEditor';
import {
  BucketAggregation,
  isBucketAggregationWithField,
} from './components/QueryEditor/BucketAggregationsEditor/aggregations';
import { bucketAggregationConfig } from './components/QueryEditor/BucketAggregationsEditor/utils';
import {
  isMetricAggregationWithField,
  isPipelineAggregationWithMultipleBucketPaths,
  Logs,
} from './components/QueryEditor/MetricAggregationsEditor/aggregations';
import { metricAggregationConfig } from './components/QueryEditor/MetricAggregationsEditor/utils';
import { ElasticResponse } from './elastic_response';
import { IndexPattern } from './index_pattern';
import LanguageProvider from './language_provider';
import { ElasticQueryBuilder } from './query_builder';
import { defaultBucketAgg, hasMetricOfType } from './query_def';
import { DataLinkConfig, ElasticsearchOptions, ElasticsearchQuery, TermsQuery } from './types';
import { coerceESVersion, getScriptValue, isSupportedVersion } from './utils';

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
  extends DataSourceApi<ElasticsearchQuery, ElasticsearchOptions>
  implements
    DataSourceWithLogsContextSupport,
    DataSourceWithQueryImportSupport<ElasticsearchQuery>,
    DataSourceWithLogsVolumeSupport<ElasticsearchQuery>
{
  basicAuth?: string;
  withCredentials?: boolean;
  url: string;
  name: string;
  index: string;
  timeField: string;
  esVersion: string;
  xpack: boolean;
  interval: string;
  maxConcurrentShardRequests?: number;
  queryBuilder: ElasticQueryBuilder;
  indexPattern: IndexPattern;
  logMessageField?: string;
  logLevelField?: string;
  dataLinks: DataLinkConfig[];
  languageProvider: LanguageProvider;
  includeFrozen: boolean;
  isProxyAccess: boolean;

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
    this.esVersion = coerceESVersion(settingsData.esVersion);
    this.xpack = Boolean(settingsData.xpack);
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
    this.includeFrozen = settingsData.includeFrozen ?? false;
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

    if (!isSupportedVersion(this.esVersion)) {
      const error = new Error(
        'Support for Elasticsearch versions after their end-of-life (currently versions < 7.10) was removed.'
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

    // fields field not supported on ES 5.x
    if (lt(this.esVersion, '5.0.0')) {
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

  interpolateVariablesInQueries(queries: ElasticsearchQuery[], scopedVars: ScopedVars): ElasticsearchQuery[] {
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

    const expandedQueries = queries.map(
      (query): ElasticsearchQuery => ({
        ...query,
        datasource: this.getRef(),
        query: this.interpolateLuceneQuery(query.query || '', scopedVars),
        bucketAggs: query.bucketAggs?.map(interpolateBucketAgg),
      })
    );

    const finalQueries: ElasticsearchQuery[] = JSON.parse(
      this.templateSrv.replace(JSON.stringify(expandedQueries), scopedVars)
    );

    return finalQueries;
  }

  testDatasource() {
    // validate that the index exist and has date field
    return lastValueFrom(
      this.getFields(['date']).pipe(
        mergeMap((dateFields) => {
          const timeField: any = find(dateFields, { text: this.timeField });
          if (!timeField) {
            return of({ status: 'error', message: 'No date field named ' + this.timeField + ' found' });
          }
          return of({ status: 'success', message: 'Index OK. Time field name OK.' });
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

    if (satisfies(this.esVersion, '>=5.6.0 <7.0.0')) {
      queryHeader['max_concurrent_shard_requests'] = this.maxConcurrentShardRequests;
    }

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

  /**
   * This method checks to ensure the user is running a 5.0+ cluster. This is
   * necessary bacause the query being used for the getLogRowContext relies on the
   * search_after feature.
   */
  showContextToggle(): boolean {
    return gte(this.esVersion, '5.0.0');
  }

  getLogRowContext = async (row: LogRowModel, options?: RowContextOptions): Promise<{ data: DataFrame[] }> => {
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
     * The LogRowContextProvider requires there is a field in the dataFrame.fields
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
  };

  getLogsVolumeDataProvider(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> | undefined {
    const isLogsVolumeAvailable = request.targets.some((target) => {
      return target.metrics?.length === 1 && target.metrics[0].type === 'logs';
    });
    if (!isLogsVolumeAvailable) {
      return undefined;
    }
    const logsVolumeRequest = cloneDeep(request);
    logsVolumeRequest.targets = logsVolumeRequest.targets.map((target) => {
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

      const logsVolumeQuery: ElasticsearchQuery = {
        refId: target.refId,
        query: target.query,
        metrics: [{ type: 'count', id: '1' }],
        timeField,
        bucketAggs,
      };
      return logsVolumeQuery;
    });

    return queryLogsVolume(this, logsVolumeRequest, {
      range: request.range,
      targets: request.targets,
      extractLevel: (dataFrame) => getLogLevelFromKey(dataFrame.name || ''),
    });
  }

  query(options: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> {
    let payload = '';
    const targets = this.interpolateVariablesInQueries(cloneDeep(options.targets), options.scopedVars);
    const sentTargets: ElasticsearchQuery[] = [];
    let targetsContainsLogsQuery = targets.some((target) => hasMetricOfType(target, 'logs'));

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);

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
        queryObj = this.queryBuilder.getLogsQuery(target, limit, adhocFilters);
      } else {
        logLimits.push();
        if (target.alias) {
          target.alias = this.interpolateLuceneQuery(target.alias, options.scopedVars);
        }

        queryObj = this.queryBuilder.build(target, adhocFilters);
      }

      const esQuery = JSON.stringify(queryObj);

      const searchType = queryObj.size === 0 && lt(this.esVersion, '5.0.0') ? 'count' : 'query_then_fetch';
      const header = this.getQueryHeader(searchType, options.range.from, options.range.to);
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
    payload = payload.replace(/"\$timeFrom"/g, options.range.from.valueOf().toString());
    payload = payload.replace(/"\$timeTo"/g, options.range.to.valueOf().toString());
    payload = this.templateSrv.replace(payload, options.scopedVars);

    const url = this.getMultiSearchUrl();

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
      })
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

            if (lt(this.esVersion, '7.0.0')) {
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
        return _map(fields, (value) => {
          return value;
        });
      })
    );
  }

  getTerms(queryDef: TermsQuery, range = getDefaultTimeRange()): Observable<MetricFindValue[]> {
    const searchType = gte(this.esVersion, '5.0.0') ? 'query_then_fetch' : 'count';
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

    if (gte(this.esVersion, '7.0.0') && this.maxConcurrentShardRequests) {
      searchParams.append('max_concurrent_shard_requests', `${this.maxConcurrentShardRequests}`);
    }

    if (gte(this.esVersion, '6.6.0') && this.xpack && this.includeFrozen) {
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
    return lastValueFrom(this.getTerms({ field: options.key }));
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
