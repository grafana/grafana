import { cloneDeep, first as _first, isNumber, isString, map as _map, find, isObject } from 'lodash';
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
  DataSourceWithToggleableQueryFiltersSupport,
  QueryFilterOptions,
  ToggleFilterAction,
  DataSourceGetTagValuesOptions,
  AdHocVariableFilter,
  DataSourceWithQueryModificationSupport,
  AdHocVariableModel,
  TypedVariableModel,
} from '@grafana/data';
import {
  DataSourceWithBackend,
  getDataSourceSrv,
  BackendSrvRequest,
  TemplateSrv,
  getTemplateSrv,
  config,
} from '@grafana/runtime';

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
import { isMetricAggregationWithMeta } from './guards';
import {
  addAddHocFilter,
  addFilterToQuery,
  addStringFilterToQuery,
  queryHasFilter,
  removeFilterFromQuery,
} from './modifyQuery';
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
  isElasticsearchResponseWithAggregations,
  isElasticsearchResponseWithHits,
  ElasticsearchHits,
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
    DataSourceWithSupplementaryQueriesSupport<ElasticsearchQuery>,
    DataSourceWithToggleableQueryFiltersSupport<ElasticsearchQuery>,
    DataSourceWithQueryModificationSupport<ElasticsearchQuery>
{
  basicAuth?: string;
  withCredentials?: boolean;
  url: string;
  name: string;
  index: string;
  timeField: string;
  interval: string;
  maxConcurrentShardRequests?: number;
  queryBuilder: ElasticQueryBuilder;
  indexPattern: IndexPattern;
  intervalPattern?: Interval;
  logLevelField?: string;
  dataLinks: DataLinkConfig[];
  languageProvider: LanguageProvider;
  includeFrozen: boolean;
  isProxyAccess: boolean;
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
    this.isProxyAccess = instanceSettings.access === 'proxy';
    const settingsData = instanceSettings.jsonData || {};
    // instanceSettings.database is deprecated and should be removed in the future
    this.index = settingsData.index ?? instanceSettings.database ?? '';
    this.timeField = settingsData.timeField;
    this.indexPattern = new IndexPattern(this.index, settingsData.interval);
    this.intervalPattern = settingsData.interval;
    this.interval = settingsData.timeInterval;
    this.maxConcurrentShardRequests = settingsData.maxConcurrentShardRequests;
    this.queryBuilder = new ElasticQueryBuilder({
      timeField: this.timeField,
    });
    this.logLevelField = settingsData.logLevelField || '';
    this.dataLinks = settingsData.dataLinks || [];
    this.includeFrozen = settingsData.includeFrozen ?? false;
    // we want to cache the database version so we don't have to ask for it every time
    this.databaseVersion = null;
    this.annotations = {
      QueryEditor: ElasticsearchAnnotationsQueryEditor,
    };

    if (this.logLevelField === '') {
      this.logLevelField = undefined;
    }
    this.languageProvider = new LanguageProvider(this);
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

  /**
   * Implemented as part of DataSourceWithQueryImportSupport.
   * Imports queries from AbstractQuery objects when switching between different data source types.
   * @returns A Promise that resolves to an array of ES queries.
   */
  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<ElasticsearchQuery[]> {
    return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
  }

  /**
   * Sends a GET request to the specified url on the newest matching and available index.
   *
   * When multiple indices span the provided time range, the request is sent starting from the newest index,
   * and then going backwards until an index is found.
   */
  private requestAllIndices(range = getDefaultTimeRange()) {
    let indexList = this.indexPattern.getIndexList(range.from, range.to);
    if (!Array.isArray(indexList)) {
      indexList = [this.indexPattern.getIndexForToday()];
    }

    const url = config.featureToggles.elasticsearchCrossClusterSearch ? '_field_caps' : '_mapping';

    const indexUrlList = indexList.map((index) => {
      // make sure `index` does not end with a slash
      index = index.replace(/\/$/, '');
      if (index === '') {
        return url;
      }

      return `${index}/${url}`;
    });

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
        return from(this.getResource(path)).pipe(catchError((err) => of({ err })));
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

  /**
   * Implemented as part of the DataSourceAPI. It allows the datasource to serve as a source of annotations for a dashboard.
   * @returns A promise that resolves to an array of AnnotationEvent objects representing the annotations for the dashboard.
   * @todo This is deprecated and it is recommended to use the `AnnotationSupport` feature for annotations.
   */
  annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const payload = this.prepareAnnotationRequest(options);
    trackAnnotationQuery(options.annotation);
    // TODO: We should migrate this to use query and not resource call
    // The plan is to look at this when we start to work on raw query editor for ES
    // as we will have to explore how to handle any query
    const annotationObservable = from(this.postResourceRequest('_msearch', payload));
    return lastValueFrom(
      annotationObservable.pipe(
        map((res: unknown) => {
          if (!isElasticsearchResponseWithHits(res)) {
            return [];
          }
          const hits = res?.responses[0].hits?.hits ?? [];
          return this.processHitsToAnnotationEvents(options.annotation, hits);
        })
      )
    );
  }

  // Private method used in the `annotationQuery` to prepare the payload for the Elasticsearch annotation request
  private prepareAnnotationRequest(options: {
    annotation: ElasticsearchAnnotationQuery;
    // Should be DashboardModel but cannot import that here from the main app. This is a temporary solution as we need to move from deprecated annotations.
    dashboard: { getVariables: () => TypedVariableModel[] };
    range: TimeRange;
  }) {
    const annotation = options.annotation;
    const timeField = annotation.timeField || '@timestamp';
    const timeEndField = annotation.timeEndField || null;
    const dashboard = options.dashboard;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const adhocVariables = dashboard.getVariables().filter((v) => v.type === 'adhoc') as AdHocVariableModel[];
    const annotationRelatedVariables = adhocVariables.filter((v) => v.datasource?.uid === annotation.datasource.uid);
    const filters = annotationRelatedVariables.map((v) => v.filters).flat();

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
    const finalQuery = this.addAdHocFilters(queryInterpolated, filters);

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

    if (finalQuery) {
      query.bool.filter.push({
        query_string: {
          query: finalQuery,
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

  // Private method used in the `annotationQuery` to process Elasticsearch hits into AnnotationEvents
  private processHitsToAnnotationEvents(annotation: ElasticsearchAnnotationQuery, hits: ElasticsearchHits) {
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

  // Replaces variables in a Lucene query string
  interpolateLuceneQuery(queryString: string, scopedVars?: ScopedVars) {
    return this.templateSrv.replace(queryString, scopedVars, 'lucene');
  }

  /**
   * Implemented as a part of DataSourceApi. Interpolates variables and adds ad hoc filters to a list of ES queries.
   * @returns An array of ES queries with interpolated variables and ad hoc filters using `applyTemplateVariables`.
   */
  interpolateVariablesInQueries(
    queries: ElasticsearchQuery[],
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): ElasticsearchQuery[] {
    return queries.map((q) => this.applyTemplateVariables(q, scopedVars, filters));
  }

  /**
   * @todo Remove as we have health checks in the backend
   */
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

  // Private method used in `getTerms` to get the header for the Elasticsearch query
  private getQueryHeader(searchType: string, timeFrom?: DateTime, timeTo?: DateTime): string {
    const queryHeader = {
      search_type: searchType,
      ignore_unavailable: true,
      index: this.indexPattern.getIndexList(timeFrom, timeTo),
    };

    return JSON.stringify(queryHeader);
  }

  /**
   * Implemented as part of DataSourceApi. Converts a ES query to a simple text string.
   * Used, for example, in Query history.
   * @returns A text representation of the query.
   */
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
   * Part of `DataSourceWithLogsContextSupport`, used to retrieve log context for a log row.
   * @returns A promise that resolves to an object containing the log context data as DataFrames.
   */
  getLogRowContext = async (row: LogRowModel, options?: LogRowContextOptions): Promise<{ data: DataFrame[] }> => {
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
  };

  /**
   * Implemented for DataSourceWithSupplementaryQueriesSupport.
   * It generates a DataQueryRequest for a specific supplementary query type.
   * @returns A DataQueryRequest for the supplementary queries or undefined if not supported.
   */
  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeDataProvider(request);
      case SupplementaryQueryType.LogsSample:
        return this.getLogsSampleDataProvider(request);
      default:
        return undefined;
    }
  }

  /**
   * Implemented for DataSourceWithSupplementaryQueriesSupport.
   * It returns the supplementary types that the data source supports.
   * @returns An array of supported supplementary query types.
   */
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
  }

  /**
   * Implemented for DataSourceWithSupplementaryQueriesSupport.
   * It retrieves supplementary queries based on the provided options and ES query.
   * @returns A supplemented ES query or undefined if unsupported.
   */
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: ElasticsearchQuery): ElasticsearchQuery | undefined {
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

  /**
   * Private method used in the `getDataProvider` for DataSourceWithSupplementaryQueriesSupport, specifically for Logs volume queries.
   * @returns An Observable of DataQueryResponse or undefined if no suitable queries are found.
   */
  private getLogsVolumeDataProvider(
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((target) => this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsVolume }, target))
      .filter((query): query is ElasticsearchQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return { ...logsVolumeRequest, targets };
  }

  /**
   * Private method used in the `getDataProvider` for DataSourceWithSupplementaryQueriesSupport, specifically for Logs sample queries.
   * @returns An Observable of DataQueryResponse or undefined if no suitable queries are found.
   */
  private getLogsSampleDataProvider(
    request: DataQueryRequest<ElasticsearchQuery>
  ): DataQueryRequest<ElasticsearchQuery> | undefined {
    const logsSampleRequest = cloneDeep(request);
    const targets = logsSampleRequest.targets;
    const queries = targets.map((query) => {
      return this.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample, limit: 100 }, query);
    });
    const elasticQueries = queries.filter((query): query is ElasticsearchQuery => !!query);

    if (!elasticQueries.length) {
      return undefined;
    }
    return { ...logsSampleRequest, targets: elasticQueries };
  }

  /**
   * Required by DataSourceApi. It executes queries based on the provided DataQueryRequest.
   * @returns An Observable of DataQueryResponse containing the query results.
   */
  query(request: DataQueryRequest<ElasticsearchQuery>): Observable<DataQueryResponse> {
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

  /**
   * Filters out queries that are hidden. Used when running queries through backend.
   * It is called from DatasourceWithBackend.
   * @returns `true` if the query is not hidden.
   */
  filterQuery(query: ElasticsearchQuery): boolean {
    if (query.hide) {
      return false;
    }
    return true;
  }

  // Private method used in the `getFields` to check if a field is a metadata field.
  private isMetadataField(fieldName: string) {
    return ELASTIC_META_FIELDS.includes(fieldName);
  }

  /**
   * Get the list of the fields to display in query editor or used for example in getTagKeys.
   * @todo instead of being a string, this could be a custom type representing all the elastic types
   * @fixme This doesn't seem to return actual MetricFindValues, we should either change the return type
   * or fix the implementation.
   */
  getFields(type?: string[], range?: TimeRange): Observable<MetricFindValue[]> {
    if (config.featureToggles.elasticsearchCrossClusterSearch) {
      return this.getFieldsCrossCluster(type, range);
    }

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
    return this.requestAllIndices(range).pipe(
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

  getFieldsCrossCluster(type?: string[], range?: TimeRange): Observable<MetricFindValue[]> {
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
    return this.requestAllIndices(range).pipe(
      map((result) => {
        interface FieldInfo {
          metadata_field: string;
        }
        const shouldAddField = (obj: Record<string, Record<string, FieldInfo>>) => {
          // equal query type filter, or via type map translation
          for (const objField in obj) {
            if (objField === 'object') {
              continue;
            }
            if (obj[objField].metadata_field) {
              continue;
            }

            if (!type || type.length === 0) {
              return true;
            }

            if (type.includes(objField) || type.includes(typeMap[objField])) {
              return true;
            }
          }
          return false;
        };

        const fields: Record<string, { text: string; type: string }> = {};

        const fieldsData = result['fields'];
        for (const fieldName in fieldsData) {
          const fieldInfo = fieldsData[fieldName];
          if (shouldAddField(fieldInfo)) {
            fields[fieldName] = {
              text: fieldName,
              type: fieldInfo.type,
            };
          }
        }

        // transform to array
        return _map(fields, (value) => {
          return value;
        });
      })
    );
  }

  /**
   * Get values for a given field.
   * Used for example in getTagValues.
   */
  getTerms(queryDef: TermsQuery, range = getDefaultTimeRange()): Observable<MetricFindValue[]> {
    const searchType = 'query_then_fetch';
    const header = this.getQueryHeader(searchType, range.from, range.to);
    let esQuery = JSON.stringify(this.queryBuilder.getTermsQuery(queryDef));

    esQuery = esQuery.replace(/\$timeFrom/g, range.from.valueOf().toString());
    esQuery = esQuery.replace(/\$timeTo/g, range.to.valueOf().toString());
    esQuery = header + '\n' + esQuery + '\n';

    const url = this.getMultiSearchUrl();

    return from(this.postResourceRequest(url, esQuery)).pipe(
      map((res: unknown) => {
        if (!isElasticsearchResponseWithAggregations(res)) {
          return [];
        }
        if (!res || !res.responses[0].aggregations) {
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

  // Method used to create URL that includes correct parameters based on ES data source config.
  getMultiSearchUrl() {
    const searchParams = new URLSearchParams();

    if (this.maxConcurrentShardRequests) {
      searchParams.append('max_concurrent_shard_requests', `${this.maxConcurrentShardRequests}`);
    }

    if (this.includeFrozen) {
      searchParams.append('ignore_throttled', 'false');
    }

    return ('_msearch?' + searchParams.toString()).replace(/\?$/, '');
  }

  /**
   * Implemented as part of DataSourceAPI and used for template variable queries.
   * @returns A Promise that resolves to an array of results from the metric find query.
   */
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

  /**
   * Implemented as part of the DataSourceAPI. Retrieves tag keys that can be used for ad-hoc filtering.
   * @returns A Promise that resolves to an array of label names represented as MetricFindValue objects.
   */
  getTagKeys() {
    return lastValueFrom(this.getFields());
  }

  /**
   * Implemented as part of the DataSourceAPI. Retrieves tag values that can be used for ad-hoc filtering.
   * @returns A Promise that resolves to an array of label values represented as MetricFindValue objects
   */
  getTagValues(options: DataSourceGetTagValuesOptions<ElasticsearchQuery>) {
    return lastValueFrom(this.getTerms({ field: options.key }, options.timeRange));
  }

  /**
   * Implemented as part of the DataSourceAPI.
   * Used by alerting to check if query contains template variables.
   */
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

  // Private method used in the `targetContainsTemplate` to check if an object contains template variables.
  private objectContainsTemplate(obj: any) {
    if (typeof obj === 'string') {
      return this.templateSrv.containsTemplate(obj);
    }
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    for (const key in obj) {
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

  /**
   * Implemented for `DataSourceWithToggleableQueryFiltersSupport`. Toggles a filter on or off based on the provided filter action.
   * It is used for example in Explore to toggle fields on and off trough log details.
   * @returns A new ES query with the filter toggled as specified.
   */
  toggleQueryFilter(query: ElasticsearchQuery, filter: ToggleFilterAction): ElasticsearchQuery {
    let expression = query.query ?? '';
    switch (filter.type) {
      case 'FILTER_FOR': {
        // This gives the user the ability to toggle a filter on and off.
        expression = queryHasFilter(expression, filter.options.key, filter.options.value)
          ? removeFilterFromQuery(expression, filter.options.key, filter.options.value)
          : addFilterToQuery(expression, filter.options.key, filter.options.value);
        break;
      }
      case 'FILTER_OUT': {
        // If the opposite filter is present, remove it before adding the new one.
        if (queryHasFilter(expression, filter.options.key, filter.options.value)) {
          expression = removeFilterFromQuery(expression, filter.options.key, filter.options.value);
        }
        expression = addFilterToQuery(expression, filter.options.key, filter.options.value, '-');
        break;
      }
    }

    return { ...query, query: expression };
  }

  /**
   * Implemented for `DataSourceWithToggleableQueryFiltersSupport`. Checks if a query expression contains a filter based on the provided filter options.
   * @returns A boolean value indicating whether the filter exists in the query expression.
   */
  queryHasFilter(query: ElasticsearchQuery, options: QueryFilterOptions): boolean {
    let expression = query.query ?? '';
    return queryHasFilter(expression, options.key, options.value);
  }

  /**
   * Implemented as part of `DataSourceWithQueryModificationSupport`. Used to modify a query based on the provided action.
   * It is used, for example, in the Query Builder to apply hints such as parsers, operations, etc.
   * @returns A new ES query with the specified modification applied.
   */
  modifyQuery(query: ElasticsearchQuery, action: QueryFixAction): ElasticsearchQuery {
    if (!action.options) {
      return query;
    }

    let expression = query.query ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        expression = addFilterToQuery(expression, action.options.key, action.options.value);
        break;
      }
      case 'ADD_FILTER_OUT': {
        expression = addFilterToQuery(expression, action.options.key, action.options.value, '-');
        break;
      }
      case 'ADD_STRING_FILTER': {
        expression = addStringFilterToQuery(expression, action.options.value);
        break;
      }
      case 'ADD_STRING_FILTER_OUT': {
        expression = addStringFilterToQuery(expression, action.options.value, false);
        break;
      }
    }

    return { ...query, query: expression };
  }

  /**
   * Implemented as part of `DataSourceWithQueryModificationSupport`. Returns a list of operation
   * types that are supported by `modifyQuery()`.
   */
  getSupportedQueryModifications() {
    return ['ADD_FILTER', 'ADD_FILTER_OUT', 'ADD_STRING_FILTER', 'ADD_STRING_FILTER_OUT'];
  }

  /**
   * Adds ad hoc filters to a query expression, handling proper escaping of filter values.
   * @returns The query expression with ad hoc filters and correctly escaped values.
   */
  addAdHocFilters(query: string, adhocFilters?: AdHocVariableFilter[]) {
    if (!adhocFilters) {
      return query;
    }
    let finalQuery = query;
    adhocFilters.forEach((filter) => {
      finalQuery = addAddHocFilter(finalQuery, filter);
    });

    return finalQuery;
  }

  /**
   * Applies template variables and add hoc filters to a query. Used when running queries through backend.
   * It is called from DatasourceWithBackend.
   * @returns A modified ES query with template variables and ad hoc filters applied.
   */
  applyTemplateVariables(
    query: ElasticsearchQuery,
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): ElasticsearchQuery {
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
      query: this.addAdHocFilters(this.interpolateLuceneQuery(query.query || '', scopedVars), filters),
      bucketAggs: query.bucketAggs?.map(interpolateBucketAgg),
    };

    const finalQuery = JSON.parse(this.templateSrv.replace(JSON.stringify(expandedQuery), scopedVars));
    return finalQuery;
  }

  // Private method used in the `getDatabaseVersion` to get the database version from the Elasticsearch API.
  private getDatabaseVersionUncached(): Promise<SemVer | null> {
    // we want this function to never fail
    const getDbVersionObservable = from(this.getResourceRequest(''));
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

  /**
   * Method used to get the database version from cache or from the Elasticsearch API.
   * Elasticsearch data source supports only certain versions of Elasticsearch and we
   * want to check the version and notify the user if the version is not supported.
   * */
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

  // private method used in the `getLogRowContext` to create a log context data request.
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

// Function to enhance the data frame with data links configured in the data source settings.
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
