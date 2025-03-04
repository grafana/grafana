import { groupBy } from 'lodash';
import { EMPTY, forkJoin, from, lastValueFrom, merge, Observable, of } from 'rxjs';
import { catchError, concatMap, map, mergeMap, toArray } from 'rxjs/operators';
import semver from 'semver';

import {
  CoreApp,
  DataFrame,
  DataFrameDTO,
  DataLink,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  LoadingState,
  NodeGraphDataFrameFieldNames,
  rangeUtil,
  ScopedVars,
  SelectableValue,
  TestDataSourceResponse,
  urlUtil,
} from '@grafana/data';
import { NodeGraphOptions, SpanBarOptions, TraceToLogsOptions } from '@grafana/o11y-ds-frontend';
import {
  BackendSrvRequest,
  config,
  DataSourceWithBackend,
  getBackendSrv,
  getDataSourceSrv,
  getTemplateSrv,
  reportInteraction,
  TemplateSrv,
} from '@grafana/runtime';
import { BarGaugeDisplayMode, TableCellDisplayMode, VariableFormatID } from '@grafana/schema';

import { generateQueryFromAdHocFilters, getTagWithoutScope, interpolateFilters } from './SearchTraceQLEditor/utils';
import { TempoVariableQuery, TempoVariableQueryType } from './VariableQueryEditor';
import { PrometheusDatasource, PromQuery } from './_importedDependencies/datasources/prometheus/types';
import { TagLimitOptions } from './configuration/TagLimitSettings';
import { SearchTableType, TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';
import {
  defaultTableFilter,
  durationMetric,
  errorRateMetric,
  failedMetric,
  histogramMetric,
  mapPromMetricsToServiceMap,
  rateMetric,
  serviceMapMetrics,
  totalsMetric,
} from './graphTransform';
import TempoLanguageProvider from './language_provider';
import { createTableFrameFromMetricsSummaryQuery, emptyResponse, MetricsSummary } from './metricsSummary';
import {
  enhanceTraceQlMetricsResponse,
  formatTraceQLResponse,
  transformFromOTLP as transformFromOTEL,
  transformTrace,
} from './resultTransformer';
import { doTempoMetricsStreaming, doTempoSearchStreaming } from './streaming';
import { TempoJsonData, TempoQuery } from './types';
import { getErrorMessage, migrateFromSearchToTraceQLSearch } from './utils';
import { TempoVariableSupport } from './variables';

export const DEFAULT_LIMIT = 20;
export const DEFAULT_SPSS = 3; // spans per span set

export enum FeatureName {
  searchStreaming = 'searchStreaming',
  metricsStreaming = 'metricsStreaming',
}

/* Map, for each feature (e.g., streaming), the minimum Tempo version required to have that
 ** feature available. If the running Tempo instance on the user's backend is older than the
 ** target version, the feature is disabled in Grafana (frontend).
 */
export const featuresToTempoVersion = {
  [FeatureName.searchStreaming]: '2.2.0',
  [FeatureName.metricsStreaming]: '2.7.0',
};

// The version that we use as default in case we cannot retrieve it from the backend.
// This is the last minor version of Tempo that does not expose the endpoint for build information.
const defaultTempoVersion = '2.1.0';

interface ServiceMapQueryResponse {
  nodes: DataFrame;
  edges: DataFrame;
}

interface ServiceMapQueryResponseWithRates {
  rates: Array<DataFrame | DataFrameDTO>;
  nodes: DataFrame;
  edges: DataFrame;
}

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TempoJsonData> {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
    filters?: TraceqlFilter[];
  };
  nodeGraph?: NodeGraphOptions;
  traceQuery?: {
    timeShiftEnabled?: boolean;
    spanStartTimeShift?: string;
    spanEndTimeShift?: string;
  };
  uploadedJson?: string | null = null;
  spanBar?: SpanBarOptions;
  tagLimit?: TagLimitOptions;
  languageProvider: TempoLanguageProvider;

  streamingEnabled?: {
    search?: boolean;
    metrics?: boolean;
  };

  // The version of Tempo running on the backend. `null` if we cannot retrieve it for whatever reason
  tempoVersion?: string | null;

  constructor(
    public instanceSettings: DataSourceInstanceSettings<TempoJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.serviceMap = instanceSettings.jsonData.serviceMap;
    this.search = instanceSettings.jsonData.search;
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
    this.traceQuery = instanceSettings.jsonData.traceQuery;
    this.streamingEnabled = instanceSettings.jsonData.streamingEnabled;

    this.languageProvider = new TempoLanguageProvider(this);

    if (!this.search?.filters) {
      this.search = {
        ...this.search,
        filters: [
          {
            id: 'service-name',
            tag: 'service.name',
            operator: '=',
            scope: TraceqlSearchScope.Resource,
          },
          { id: 'span-name', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
        ],
      };
    }

    this.variables = new TempoVariableSupport(this);
  }

  async executeVariableQuery(query: TempoVariableQuery) {
    // Avoid failing if the user did not select the query type (label names, label values, etc.)
    if (query.type === undefined) {
      return new Promise<Array<{ text: string }>>(() => []);
    }

    switch (query.type) {
      case TempoVariableQueryType.LabelNames: {
        return await this.labelNamesQuery();
      }
      case TempoVariableQueryType.LabelValues: {
        return this.labelValuesQuery(query.label);
      }
      default: {
        throw Error('Invalid query type: ' + query.type);
      }
    }
  }

  async labelNamesQuery(): Promise<Array<{ text: string }>> {
    await this.languageProvider.fetchTags();
    const tags = this.languageProvider.getAutocompleteTags();
    return tags.filter((tag) => tag !== undefined).map((tag) => ({ text: tag }));
  }

  async labelValuesQuery(labelName?: string): Promise<Array<{ text: string }>> {
    if (!labelName) {
      return [];
    }

    let options;
    try {
      // Retrieve the scope of the tag
      // Example: given `http.status_code`, we want scope `span`
      // Note that we ignore possible name clashes, e.g., `http.status_code` in both `span` and `resource`
      const scope: string | undefined = (this.languageProvider.tagsV2 || [])
        // flatten the Scope objects
        .flatMap((tagV2) => tagV2.tags.map((tag) => ({ scope: tagV2.name, name: tag })))
        // find associated scope
        .find((tag) => tag.name === labelName)?.scope;
      if (!scope) {
        throw Error(`Scope for tag ${labelName} not found`);
      }

      // For V2, we need to send scope and tag name, e.g. `span.http.status_code`,
      // unless the tag has intrinsic scope
      const scopeAndTag = scope === 'intrinsic' ? labelName : `${scope}.${labelName}`;
      options = await this.languageProvider.getOptionsV2(scopeAndTag);
    } catch {
      // For V1, the tag name (e.g. `http.status_code`) is enough
      options = await this.languageProvider.getOptionsV1(labelName);
    }

    return options.flatMap((option: SelectableValue<string>) =>
      option.value !== undefined ? [{ text: option.value }] : []
    );
  }

  // Allows to retrieve the list of tags for ad-hoc filters
  async getTagKeys(): Promise<Array<{ text: string }>> {
    await this.languageProvider.fetchTags();
    const tags = this.languageProvider.tagsV2 || [];
    return tags
      .map(({ name, tags }) =>
        tags.filter((tag) => tag !== undefined).map((t) => (name !== 'intrinsic' ? `${name}.${t}` : `${t}`))
      )
      .flat()
      .map((tag) => ({ text: tag }));
  }

  // Allows to retrieve the list of tag values for ad-hoc filters
  getTagValues(options: DataSourceGetTagValuesOptions<TempoQuery>): Promise<Array<{ text: string }>> {
    const query = generateQueryFromAdHocFilters(options.filters, this.languageProvider);
    return this.tagValuesQuery(options.key, query);
  }

  async tagValuesQuery(tag: string, query: string): Promise<Array<{ text: string }>> {
    let options;
    try {
      // For V2, we need to send scope and tag name, e.g. `span.http.status_code`,
      // unless the tag has intrinsic scope
      options = await this.languageProvider.getOptionsV2(tag, query);
    } catch {
      // For V1, the tag name (e.g. `http.status_code`) is enough
      options = await this.languageProvider.getOptionsV1(getTagWithoutScope(tag));
    }

    return options.flatMap((option: SelectableValue<string>) =>
      option.value !== undefined ? [{ text: option.value }] : []
    );
  }

  init = async () => {
    const response = await lastValueFrom(
      this._request('/api/status/buildinfo').pipe(
        map((response) => response),
        catchError((error) => {
          console.error('Failure in retrieving build information', error.data.message);
          return of({ error, data: { version: null } }); // unknown version
        })
      )
    );
    this.tempoVersion = response.data.version;
  };

  /**
   * Check, for the given feature, whether it is available in Grafana.
   *
   * The check is done based on the version of the Tempo instance running on the backend and
   * the minimum version required by the given feature to work.
   *
   * @param featureName - the name of the feature to consider
   * @return true if the feature is available, false otherwise
   */
  isFeatureAvailable(featureName: FeatureName) {
    // We know for old Tempo instances we don't know their version, so resort to default
    const actualVersion = this.tempoVersion ?? defaultTempoVersion;

    try {
      return semver.gte(actualVersion, featuresToTempoVersion[featureName]);
    } catch {
      // We assume we are on a development and recent branch, thus we enable all features
      return true;
    }
  }

  /**
   * Check if streaming for search queries is enabled (and available).
   *
   * We need to check:
   * - the Tempo data source plugin toggle, to disable streaming if the user disabled it in the data source configuration
   * - if Grafana Live is enabled
   *
   * @return true if streaming for search queries is enabled, false otherwise
   */
  isStreamingSearchEnabled() {
    return this.streamingEnabled?.search && config.liveEnabled;
  }
  /**
   * Check if streaming for metrics queries is enabled (and available).
   *
   * We need to check:
   * - the Tempo data source plugin toggle, to disable streaming if the user disabled it in the data source configuration
   * - if Grafana Live is enabled
   *
   * @return true if streaming for metrics queries is enabled, false otherwise
   */
  isStreamingMetricsEnabled() {
    return this.streamingEnabled?.metrics && config.liveEnabled;
  }

  isTraceQlMetricsQuery(query: string): boolean {
    // Check whether this is a metrics query by checking if it contains a metrics function
    const metricsFnRegex =
      /\|\s*(rate|count_over_time|avg_over_time|max_over_time|min_over_time|quantile_over_time|histogram_over_time|compare)\s*\(/;
    return !!query.trim().match(metricsFnRegex);
  }

  isTraceIdQuery(query: string): boolean {
    const hexOnlyRegex = /^[0-9A-Fa-f]*$/;
    // Check whether this is a trace ID or traceQL query by checking if it only contains hex characters
    return !!query.trim().match(hexOnlyRegex);
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const targets: { [type: string]: TempoQuery[] } = groupBy(filteredTargets, (t) => t.queryType || 'traceql');

    if (targets.clear) {
      return of({ data: [], state: LoadingState.Done });
    }

    // Migrate user to new query type if they are using the old search query type
    if (targets.nativeSearch?.length) {
      if (
        targets.nativeSearch[0].spanName ||
        targets.nativeSearch[0].serviceName ||
        targets.nativeSearch[0].search ||
        targets.nativeSearch[0].maxDuration ||
        targets.nativeSearch[0].minDuration ||
        targets.nativeSearch[0].queryType === 'nativeSearch'
      ) {
        const migratedQuery = migrateFromSearchToTraceQLSearch(targets.nativeSearch[0]);
        if (targets.traceqlSearch?.length) {
          targets.traceqlSearch.push(migratedQuery);
        } else {
          targets.traceqlSearch = [migratedQuery];
        }
      }
    }

    if (targets.traceql?.length) {
      try {
        const appliedQuery = this.applyVariables(targets.traceql[0], options.scopedVars);
        const queryValue = appliedQuery?.query || '';
        // Check whether this is a trace ID or traceQL query by checking if it only contains hex characters
        if (this.isTraceIdQuery(queryValue)) {
          // There's only hex characters so let's assume that this is a trace ID
          reportInteraction('grafana_traces_traceID_queried', {
            datasourceType: 'tempo',
            app: options.app ?? '',
            grafana_version: config.buildInfo.version,
            hasQuery: queryValue !== '' ? true : false,
          });

          subQueries.push(this.handleTraceIdQuery(options, targets.traceql));
        } else {
          if (this.isTraceQlMetricsQuery(queryValue)) {
            reportInteraction('grafana_traces_traceql_metrics_queried', {
              datasourceType: 'tempo',
              app: options.app ?? '',
              grafana_version: config.buildInfo.version,
              query: queryValue ?? '',
              streaming: this.isStreamingMetricsEnabled(),
            });
            if (this.isStreamingMetricsEnabled()) {
              subQueries.push(this.handleMetricsStreamingQuery(options, targets.traceql, queryValue));
            } else {
              subQueries.push(this.handleTraceQlMetricsQuery(options, targets.traceql));
            }
          } else {
            reportInteraction('grafana_traces_traceql_queried', {
              datasourceType: 'tempo',
              app: options.app ?? '',
              grafana_version: config.buildInfo.version,
              query: queryValue ?? '',
              streaming: this.isStreamingSearchEnabled(),
            });
            subQueries.push(this.handleTraceQlQuery(options, targets, queryValue));
          }
        }
      } catch (error) {
        return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
      }
    }

    if (targets.traceqlSearch?.length) {
      try {
        if (config.featureToggles.metricsSummary) {
          const target = targets.traceqlSearch.find((t) => this.hasGroupBy(t));
          if (target) {
            const appliedQuery = this.applyVariables(target, options.scopedVars);
            const queryFromFilters = this.languageProvider.generateQueryFromFilters(appliedQuery.filters);
            subQueries.push(this.handleMetricsSummaryQuery(appliedQuery, queryFromFilters, options));
          }
        }

        const traceqlSearchTargets = config.featureToggles.metricsSummary
          ? targets.traceqlSearch.filter((t) => !this.hasGroupBy(t))
          : targets.traceqlSearch;
        if (traceqlSearchTargets.length > 0) {
          const appliedQuery = this.applyVariables(traceqlSearchTargets[0], options.scopedVars);
          const queryFromFilters = this.languageProvider.generateQueryFromFilters(appliedQuery.filters);

          reportInteraction('grafana_traces_traceql_search_queried', {
            datasourceType: 'tempo',
            app: options.app ?? '',
            grafana_version: config.buildInfo.version,
            query: queryFromFilters ?? '',
            streaming: this.isStreamingSearchEnabled(),
          });

          if (this.isStreamingSearchEnabled()) {
            subQueries.push(this.handleStreamingQuery(options, traceqlSearchTargets, queryFromFilters));
          } else {
            subQueries.push(
              this._request('/api/search', {
                q: queryFromFilters,
                limit: options.targets[0].limit ?? DEFAULT_LIMIT,
                spss: options.targets[0].spss ?? DEFAULT_SPSS,
                start: options.range.from.unix(),
                end: options.range.to.unix(),
              }).pipe(
                map((response) => {
                  return {
                    data: formatTraceQLResponse(
                      response.data.traces,
                      this.instanceSettings,
                      targets.traceqlSearch[0].tableType
                    ),
                  };
                }),
                catchError((err) => {
                  return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
                })
              )
            );
          }
        }
      } catch (error) {
        return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
      }
    }

    if (targets.upload?.length) {
      if (this.uploadedJson) {
        reportInteraction('grafana_traces_json_file_uploaded', {
          datasourceType: 'tempo',
          app: options.app ?? '',
          grafana_version: config.buildInfo.version,
        });

        const jsonData = JSON.parse(this.uploadedJson);
        const isTraceData = jsonData.batches;
        const isServiceGraphData =
          Array.isArray(jsonData) && jsonData.some((df) => df?.meta?.preferredVisualisationType === 'nodeGraph');

        if (isTraceData) {
          subQueries.push(of(transformFromOTEL(jsonData.batches, this.nodeGraph?.enabled)));
        } else if (isServiceGraphData) {
          subQueries.push(of({ data: jsonData, state: LoadingState.Done }));
        } else {
          subQueries.push(of({ error: { message: 'Unable to parse uploaded data.' }, data: [] }));
        }
      } else {
        subQueries.push(of({ data: [], state: LoadingState.Done }));
      }
    }

    if (this.serviceMap?.datasourceUid && targets.serviceMap?.length > 0) {
      reportInteraction('grafana_traces_service_graph_queried', {
        datasourceType: 'tempo',
        app: options.app ?? '',
        grafana_version: config.buildInfo.version,
        hasServiceMapQuery: targets.serviceMap[0].serviceMapQuery ? true : false,
      });

      const dsId = this.serviceMap.datasourceUid;
      const tempoDsUid = this.uid;
      subQueries.push(
        serviceMapQuery(options, dsId, tempoDsUid).pipe(
          concatMap((result) =>
            rateQuery(options, result, dsId).pipe(
              concatMap((result) => errorAndDurationQuery(options, result, dsId, tempoDsUid))
            )
          )
        )
      );
    }

    return merge(...subQueries);
  }

  applyTemplateVariables(query: TempoQuery, scopedVars: ScopedVars) {
    return this.applyVariables(query, scopedVars);
  }

  interpolateVariablesInQueries(queries: TempoQuery[], scopedVars: ScopedVars): TempoQuery[] {
    if (!queries || queries.length === 0) {
      return [];
    }

    return queries.map((query) => {
      return {
        ...query,
        datasource: this.getRef(),
        ...this.applyVariables(query, scopedVars),
      };
    });
  }

  applyVariables(query: TempoQuery, scopedVars: ScopedVars) {
    const expandedQuery = { ...query };

    if (query.filters) {
      expandedQuery.filters = interpolateFilters(query.filters, scopedVars);
    }

    if (query.groupBy) {
      expandedQuery.groupBy = query.groupBy.map((filter) => {
        const updatedFilter = {
          ...filter,
          tag: this.templateSrv.replace(filter.tag ?? '', scopedVars),
        };

        return updatedFilter;
      });
    }

    return {
      ...expandedQuery,
      query: this.templateSrv.replace(query.query ?? '', scopedVars, VariableFormatID.Pipe),
      serviceMapQuery: Array.isArray(query.serviceMapQuery)
        ? query.serviceMapQuery.map((query) => this.templateSrv.replace(query, scopedVars))
        : this.templateSrv.replace(query.serviceMapQuery ?? '', scopedVars),
    };
  }

  formatGroupBy = (groupBy: TraceqlFilter[]) => {
    return groupBy
      ?.filter((f) => f.tag)
      .map((f) => {
        if (f.scope === TraceqlSearchScope.Unscoped) {
          return `.${f.tag}`;
        }
        return f.scope !== TraceqlSearchScope.Intrinsic ? `${f.scope}.${f.tag}` : f.tag;
      })
      .join(', ');
  };

  hasGroupBy = (query: TempoQuery) => {
    return query.groupBy?.find((gb) => gb.tag);
  };

  /**
   * Handles the simplest of the queries where we have just a trace id and return trace data for it.
   * @param options
   * @param targets
   * @private
   */
  handleTraceIdQuery(options: DataQueryRequest<TempoQuery>, targets: TempoQuery[]): Observable<DataQueryResponse> {
    const validTargets = targets
      .filter((t) => t.query)
      .map((t): TempoQuery => ({ ...t, query: t.query?.trim(), queryType: 'traceId' }));
    if (!validTargets.length) {
      return EMPTY;
    }

    const request = this.makeTraceIdRequest(options, validTargets);
    return super.query(request).pipe(
      map((response) => {
        if (response.error) {
          return response;
        }
        return transformTrace(response, this.instanceSettings, this.nodeGraph?.enabled);
      })
    );
  }

  handleTraceQlQuery = (
    options: DataQueryRequest<TempoQuery>,
    targets: {
      [type: string]: TempoQuery[];
    },
    queryValue: string
  ): Observable<DataQueryResponse> => {
    if (this.isStreamingSearchEnabled()) {
      return this.handleStreamingQuery(options, targets.traceql, queryValue);
    } else {
      return this._request('/api/search', {
        q: queryValue,
        limit: options.targets[0].limit ?? DEFAULT_LIMIT,
        spss: options.targets[0].spss ?? DEFAULT_SPSS,
        start: options.range.from.unix(),
        end: options.range.to.unix(),
      }).pipe(
        map((response) => {
          return {
            data: formatTraceQLResponse(response.data.traces, this.instanceSettings, targets.traceql[0].tableType),
          };
        }),
        catchError((err) => {
          return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
        })
      );
    }
  };

  handleTraceQlMetricsQuery(
    options: DataQueryRequest<TempoQuery>,
    targets: TempoQuery[]
  ): Observable<DataQueryResponse> {
    const validTargets = targets
      .filter((t) => t.query)
      .map(
        (t): TempoQuery => ({ ...t, query: this.applyVariables(t, options.scopedVars).query, queryType: 'traceql' })
      );
    if (!validTargets.length) {
      return EMPTY;
    }

    const request = { ...options, targets: validTargets };
    return super.query(request).pipe(
      map((response) => {
        return enhanceTraceQlMetricsResponse(response, this.instanceSettings);
      }),
      catchError((err) => {
        return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
      })
    );
  }

  handleMetricsSummaryQuery = (target: TempoQuery, query: string, options: DataQueryRequest<TempoQuery>) => {
    reportInteraction('grafana_traces_metrics_summary_queried', {
      datasourceType: 'tempo',
      app: options.app ?? '',
      grafana_version: config.buildInfo.version,
      filterCount: target.groupBy?.length ?? 0,
    });

    if (query === '{}') {
      return of({
        error: {
          message:
            'Please ensure you do not have an empty query. This is so filters are applied and the metrics summary is not generated from all spans.',
        },
        data: emptyResponse,
      });
    }

    const groupBy = target.groupBy ? this.formatGroupBy(target.groupBy) : '';
    return this._request('/api/metrics/summary', {
      q: query,
      groupBy,
      start: options.range.from.unix(),
      end: options.range.to.unix(),
    }).pipe(
      map((response) => {
        if (!response.data.summaries) {
          return {
            error: {
              message: getErrorMessage(`No summary data for '${groupBy}'.`),
            },
            data: emptyResponse,
          };
        }
        // Check if any of the results have series data as older versions of Tempo placed the series data in a different structure
        const hasSeries = response.data.summaries.some((summary: MetricsSummary) => summary.series.length > 0);
        if (!hasSeries) {
          return {
            error: {
              message: getErrorMessage(`No series data. Ensure you are using an up to date version of Tempo`),
            },
            data: emptyResponse,
          };
        }
        return {
          data: createTableFrameFromMetricsSummaryQuery(response.data.summaries, query, this.instanceSettings),
        };
      }),
      catchError((error) => {
        return of({
          error: { message: getErrorMessage(error.data.message) },
          data: emptyResponse,
        });
      })
    );
  };

  // This function can probably be simplified by avoiding passing both `targets` and `query`,
  // since `query` is built from `targets`, if you look at how this function is currently called
  handleStreamingQuery(
    options: DataQueryRequest<TempoQuery>,
    targets: TempoQuery[],
    query: string
  ): Observable<DataQueryResponse> {
    if (query === '') {
      return EMPTY;
    }

    return merge(
      ...targets.map((target) =>
        doTempoSearchStreaming(
          { ...target, query },
          this, // the datasource
          options,
          this.instanceSettings
        )
      )
    );
  }

  // This function can probably be simplified by avoiding passing both `targets` and `query`,
  // since `query` is built from `targets`, if you look at how this function is currently called
  handleMetricsStreamingQuery(
    options: DataQueryRequest<TempoQuery>,
    targets: TempoQuery[],
    query: string
  ): Observable<DataQueryResponse> {
    if (query === '') {
      return EMPTY;
    }

    return merge(
      ...targets.map((target) =>
        doTempoMetricsStreaming(
          { ...target, query },
          this, // the datasource
          options
        )
      )
    );
  }

  makeTraceIdRequest(options: DataQueryRequest<TempoQuery>, targets: TempoQuery[]): DataQueryRequest<TempoQuery> {
    const request = {
      ...options,
      targets,
    };

    if (this.traceQuery?.timeShiftEnabled) {
      request.range = options.range && {
        ...options.range,
        from: dateTime(options.range.from).subtract(
          rangeUtil.intervalToMs(this.traceQuery?.spanStartTimeShift || '30m'),
          'milliseconds'
        ),
        to: dateTime(options.range.to).add(
          rangeUtil.intervalToMs(this.traceQuery?.spanEndTimeShift || '30m'),
          'milliseconds'
        ),
      };
    } else {
      request.range = { from: dateTime(0), to: dateTime(0), raw: { from: dateTime(0), to: dateTime(0) } };
    }

    return request;
  }

  async metadataRequest(url: string, params = {}) {
    return await lastValueFrom(this._request(url, params, { method: 'GET', hideFromInspector: true }));
  }

  _request(apiUrl: string, data?: unknown, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    const params = data ? urlUtil.serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = { ...options, url };
    return getBackendSrv().fetch(req);
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    const observables = [];

    const options: BackendSrvRequest = {
      headers: {},
      method: 'GET',
      url: `${this.instanceSettings.url}/api/echo`,
    };
    observables.push(
      getBackendSrv()
        .fetch(options)
        .pipe(
          mergeMap(() => {
            return of({ status: 'success', message: 'Health check succeeded' });
          }),
          catchError((err) => {
            return of({
              status: 'error',
              message: getErrorMessage(err.data.message, 'Unable to connect with Tempo'),
            });
          })
        )
    );

    if (this.streamingEnabled?.search) {
      const now = new Date();
      const from = new Date(now);
      from.setMinutes(from.getMinutes() - 15);
      observables.push(
        this.handleStreamingQuery(
          {
            range: {
              from: dateTime(from),
              to: dateTime(now),
              raw: { from: 'now-15m', to: 'now' },
            },
            requestId: '',
            interval: '',
            intervalMs: 0,
            scopedVars: {},
            targets: [],
            timezone: '',
            app: '',
            startTime: 0,
          },
          [
            {
              datasource: this.instanceSettings,
              limit: 1,
              query: '{}',
              queryType: 'traceql',
              refId: 'A',
              tableType: SearchTableType.Traces,
              filters: [],
            },
          ],
          '{}'
        ).pipe(
          mergeMap(() => {
            return of({ status: 'success', message: 'Streaming test succeeded.' });
          }),
          catchError((err) => {
            return of({
              status: 'error',
              message: getErrorMessage(err.data.message, 'Test for streaming failed, consider disabling streaming'),
            });
          })
        )
      );
    }

    return await lastValueFrom(
      forkJoin(observables).pipe(
        mergeMap((observableResults) => {
          const erroredResult = observableResults.find((result) => result.status !== 'success');
          return erroredResult
            ? of(erroredResult)
            : of({ status: 'success', message: 'Successfully connected to Tempo data source.' });
        })
      )
    );
  }

  getQueryDisplayText(query: TempoQuery) {
    if (query.queryType === 'traceql' || query.queryType === 'traceId') {
      return query.query ?? '';
    }

    const appliedQuery = this.applyVariables(query, {});
    return this.languageProvider.generateQueryFromFilters(appliedQuery.filters);
  }
}

function queryPrometheus(request: DataQueryRequest<PromQuery>, datasourceUid: string) {
  return from(getDataSourceSrv().get(datasourceUid)).pipe(
    mergeMap((ds) => {
      return (ds as PrometheusDatasource).query(request);
    })
  );
}

function serviceMapQuery(
  request: DataQueryRequest<TempoQuery>,
  datasourceUid: string,
  tempoDatasourceUid: string
): Observable<ServiceMapQueryResponse> {
  const serviceMapRequest = makePromServiceMapRequest(request);

  return queryPrometheus(serviceMapRequest, datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(),
    map((responses: DataQueryResponse[]) => {
      const errorRes = responses.find((res) => !!res.error);
      if (errorRes) {
        throw new Error(getErrorMessage(errorRes.error?.message));
      }

      const { nodes, edges } = mapPromMetricsToServiceMap(responses, request.range);
      if (nodes.fields.length > 0 && edges.fields.length > 0) {
        const nodeLength = nodes.fields[0].values.length;
        const edgeLength = edges.fields[0].values.length;

        reportInteraction('grafana_traces_service_graph_size', {
          datasourceType: 'tempo',
          grafana_version: config.buildInfo.version,
          nodeLength,
          edgeLength,
        });
      }

      // No handling of multiple targets assume just one. NodeGraph does not support it anyway, but still should be
      // fixed at some point.
      const { serviceMapIncludeNamespace, refId } = request.targets[0];
      nodes.refId = refId;
      edges.refId = refId;

      if (serviceMapIncludeNamespace) {
        nodes.fields[0].config = getFieldConfig(
          datasourceUid, // datasourceUid
          tempoDatasourceUid, // tempoDatasourceUid
          '__data.fields.title', // targetField
          '__data.fields[0]', // tempoField
          undefined, // sourceField
          { targetNamespace: '__data.fields.subtitle' }
        );

        edges.fields[0].config = getFieldConfig(
          datasourceUid, // datasourceUid
          tempoDatasourceUid, // tempoDatasourceUid
          '__data.fields.targetName', // targetField
          '__data.fields.target', // tempoField
          '__data.fields.sourceName', // sourceField
          { targetNamespace: '__data.fields.targetNamespace', sourceNamespace: '__data.fields.sourceNamespace' }
        );
      } else {
        nodes.fields[0].config = getFieldConfig(
          datasourceUid,
          tempoDatasourceUid,
          '__data.fields.id',
          '__data.fields[0]'
        );
        edges.fields[0].config = getFieldConfig(
          datasourceUid,
          tempoDatasourceUid,
          '__data.fields.target',
          '__data.fields.target',
          '__data.fields.source'
        );
      }

      return {
        nodes,
        edges,
        state: LoadingState.Done,
      };
    })
  );
}

function rateQuery(
  request: DataQueryRequest<TempoQuery>,
  serviceMapResponse: ServiceMapQueryResponse,
  datasourceUid: string
): Observable<ServiceMapQueryResponseWithRates> {
  const serviceMapRequest = makePromServiceMapRequest(request);
  serviceMapRequest.targets = makeServiceGraphViewRequest([buildExpr(rateMetric, defaultTableFilter, request)]);

  return queryPrometheus(serviceMapRequest, datasourceUid).pipe(
    toArray(),
    map((responses: DataQueryResponse[]) => {
      const errorRes = responses.find((res) => !!res.error);
      if (errorRes) {
        throw new Error(getErrorMessage(errorRes.error?.message));
      }
      return {
        rates: responses[0]?.data ?? [],
        nodes: serviceMapResponse.nodes,
        edges: serviceMapResponse.edges,
      };
    })
  );
}

// we need the response from the rate query to get the rate span_name(s),
// -> which determine the errorRate/duration span_name(s) we need to query
function errorAndDurationQuery(
  request: DataQueryRequest<TempoQuery>,
  rateResponse: ServiceMapQueryResponseWithRates,
  datasourceUid: string,
  tempoDatasourceUid: string
) {
  let serviceGraphViewMetrics = [];
  let errorRateBySpanName = '';
  let durationsBySpanName: string[] = [];

  let labels = [];
  if (rateResponse.rates[0] && request.app === CoreApp.Explore) {
    const spanNameField = rateResponse.rates[0].fields.find((field) => field.name === 'span_name');
    if (spanNameField && spanNameField.values) {
      labels = spanNameField.values;
    }
  } else if (rateResponse.rates) {
    rateResponse.rates.map((df: DataFrame | DataFrameDTO) => {
      const spanNameLabels = df.fields.find((field) => field.labels?.['span_name']);
      if (spanNameLabels) {
        labels.push(spanNameLabels.labels?.['span_name']);
      }
    });
  }
  const spanNames = getEscapedSpanNames(labels);

  if (spanNames.length > 0) {
    errorRateBySpanName = buildExpr(errorRateMetric, 'span_name=~"' + spanNames.join('|') + '"', request);
    serviceGraphViewMetrics.push(errorRateBySpanName);
    spanNames.map((name: string) => {
      const metric = buildExpr(durationMetric, 'span_name=~"' + name + '"', request);
      durationsBySpanName.push(metric);
      serviceGraphViewMetrics.push(metric);
    });
  }

  const serviceMapRequest = makePromServiceMapRequest(request);
  serviceMapRequest.targets = makeServiceGraphViewRequest(serviceGraphViewMetrics);

  return queryPrometheus(serviceMapRequest, datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(),
    map((errorAndDurationResponse: DataQueryResponse[]) => {
      const errorRes = errorAndDurationResponse.find((res) => !!res.error);
      if (errorRes) {
        throw new Error(getErrorMessage(errorRes.error?.message));
      }

      const serviceGraphView = getServiceGraphViewDataFrames(
        request,
        rateResponse,
        errorAndDurationResponse[0],
        errorRateBySpanName,
        durationsBySpanName,
        datasourceUid,
        tempoDatasourceUid
      );

      if (serviceGraphView.fields.length === 0) {
        return {
          data: [rateResponse.nodes, rateResponse.edges],
          state: LoadingState.Done,
        };
      }

      return {
        data: [serviceGraphView, rateResponse.nodes, rateResponse.edges],
        state: LoadingState.Done,
      };
    })
  );
}

function makePromLink(title: string, expr: string, datasourceUid: string, instant: boolean) {
  return {
    url: '',
    title,
    internal: {
      query: {
        expr: expr,
        range: !instant,
        exemplar: !instant,
        instant: instant,
      },
      datasourceUid,
      datasourceName: getDataSourceSrv().getInstanceSettings(datasourceUid)?.name ?? '',
    },
  };
}

// TODO: this is basically the same as prometheus/datasource.ts#prometheusSpecialRegexEscape which is used to escape
//  template variable values. It would be best to move it to some common place.
export function getEscapedSpanNames(values: string[]) {
  return values.map((value: string) => value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&'));
}

export function getFieldConfig(
  datasourceUid: string,
  tempoDatasourceUid: string,
  targetField: string,
  tempoField: string,
  sourceField?: string,
  namespaceFields?: { targetNamespace: string; sourceNamespace?: string }
) {
  let source = sourceField ? `client="\${${sourceField}}",` : '';
  let target = `server="\${${targetField}}"`;
  let serverSumBy = 'server';

  if (namespaceFields !== undefined) {
    const { targetNamespace } = namespaceFields;
    target += `,server_service_namespace="\${${targetNamespace}}"`;
    serverSumBy += ', server_service_namespace';

    if (source) {
      const { sourceNamespace } = namespaceFields;
      source += `client_service_namespace="\${${sourceNamespace}}",`;
      serverSumBy += ', client_service_namespace';
    }
  }

  return {
    links: [
      makePromLink(
        'Request rate',
        `sum by (client, ${serverSumBy})(rate(${totalsMetric}{${source}${target}}[$__rate_interval]))`,
        datasourceUid,
        false
      ),
      makePromLink(
        'Request histogram',
        `histogram_quantile(0.9, sum(rate(${histogramMetric}{${source}${target}}[$__rate_interval])) by (le, client, ${serverSumBy}))`,
        datasourceUid,
        false
      ),
      makePromLink(
        'Failed request rate',
        `sum by (client, ${serverSumBy})(rate(${failedMetric}{${source}${target}}[$__rate_interval]))`,
        datasourceUid,
        false
      ),
      makeTempoLinkServiceMap('View traces', tempoDatasourceUid, !!namespaceFields?.targetNamespace),
    ],
  };
}

export function makeTempoLink(
  title: string,
  serviceNamespace: string | undefined,
  serviceName: string,
  spanName: string,
  datasourceUid: string
) {
  let query: TempoQuery = { refId: 'A', queryType: 'traceqlSearch', filters: [] };
  if (serviceNamespace !== undefined && serviceNamespace !== '') {
    query.filters.push({
      id: 'service-namespace',
      scope: TraceqlSearchScope.Resource,
      tag: 'service.namespace',
      value: serviceNamespace,
      operator: '=',
      valueType: 'string',
    });
  }
  if (serviceName !== '') {
    query.filters.push({
      id: 'service-name',
      scope: TraceqlSearchScope.Resource,
      tag: 'service.name',
      value: serviceName,
      operator: '=',
      valueType: 'string',
    });
  }
  if (spanName !== '') {
    query.filters.push({
      id: 'span-name',
      scope: TraceqlSearchScope.Span,
      tag: 'name',
      value: spanName,
      operator: '=',
      valueType: 'string',
    });
  }

  return {
    url: '',
    title,
    internal: {
      query,
      datasourceUid,
      datasourceName: getDataSourceSrv().getInstanceSettings(datasourceUid)?.name ?? '',
    },
  };
}

function makeTempoLinkServiceMap(
  title: string,
  datasourceUid: string,
  includeNamespace: boolean
): DataLink<TempoQuery> {
  return {
    url: '',
    title,
    internal: {
      datasourceUid,
      datasourceName: getDataSourceSrv().getInstanceSettings(datasourceUid)?.name ?? '',
      query: ({ replaceVariables, scopedVars }) => {
        const serviceName = replaceVariables?.(`\${__data.fields.${NodeGraphDataFrameFieldNames.title}}`, scopedVars);
        const serviceNamespace = replaceVariables?.(
          `\${__data.fields.${NodeGraphDataFrameFieldNames.subTitle}}`,
          scopedVars
        );
        const isInstrumented =
          replaceVariables?.(`\${__data.fields.${NodeGraphDataFrameFieldNames.isInstrumented}}`, scopedVars) !==
          'false';
        const query: TempoQuery = { refId: 'A', queryType: 'traceqlSearch', filters: [] };

        // Only do the peer query if service is actively set as not instrumented
        if (isInstrumented === false) {
          const filters = ['db.name', 'db.system', 'peer.service', 'messaging.system', 'net.peer.name']
            .map((peerAttribute) => `span.${peerAttribute}="${serviceName}"`)
            .join(' || ');
          query.queryType = 'traceql';
          query.query = `{${filters}}`;
        } else {
          if (includeNamespace && serviceNamespace) {
            query.filters.push({
              id: 'service-namespace',
              scope: TraceqlSearchScope.Resource,
              tag: 'service.namespace',
              value: serviceNamespace,
              operator: '=',
              valueType: 'string',
            });
          }
          if (serviceName) {
            query.filters.push({
              id: 'service-name',
              scope: TraceqlSearchScope.Resource,
              tag: 'service.name',
              value: serviceName,
              operator: '=',
              valueType: 'string',
            });
          }
        }

        return query;
      },
    },
  };
}

function makePromServiceMapRequest(options: DataQueryRequest<TempoQuery>): DataQueryRequest<PromQuery> {
  return {
    ...options,
    targets: serviceMapMetrics
      .map<PromQuery[]>((metric) => {
        const { serviceMapQuery, serviceMapIncludeNamespace: serviceMapIncludeNamespace } = options.targets[0];
        const extraSumByFields = serviceMapIncludeNamespace
          ? ', client_service_namespace, server_service_namespace'
          : '';
        const queries = Array.isArray(serviceMapQuery) ? serviceMapQuery : [serviceMapQuery];
        const sumSubExprs = queries.map(
          (query) => `sum by (client, server${extraSumByFields}) (rate(${metric}${query || ''}[$__range]))`
        );
        const groupSubExprs = queries.map(
          (query) => `group by (client, connection_type, server${extraSumByFields}) (${metric}${query || ''})`
        );

        return [
          {
            format: 'table',
            refId: metric,
            // options.targets[0] is not correct here, but not sure what should happen if you have multiple queries for
            // service map at the same time anyway
            expr: sumSubExprs.join(' OR '),
            instant: true,
          },
          {
            format: 'table',
            refId: `${metric}_labels`,
            expr: groupSubExprs.join(' OR '),
            instant: true,
          },
        ];
      })
      .flat(),
  };
}

function getServiceGraphViewDataFrames(
  request: DataQueryRequest<TempoQuery>,
  rateResponse: ServiceMapQueryResponseWithRates,
  secondResponse: DataQueryResponse,
  errorRateBySpanName: string,
  durationsBySpanName: string[],
  datasourceUid: string,
  tempoDatasourceUid: string
) {
  let df: any = { fields: [] };

  const rate = rateResponse.rates.filter((x) => {
    return x.refId === buildExpr(rateMetric, defaultTableFilter, request);
  });
  const errorRate = secondResponse.data.filter((x) => {
    return x.refId === errorRateBySpanName;
  });
  const duration = secondResponse.data.filter((x) => {
    return durationsBySpanName.includes(x.refId ?? '');
  });

  if (rate.length > 0 && rate[0].fields?.length > 2) {
    df.fields.push({
      ...rate[0].fields[1],
      name: 'Name',
      config: {
        filterable: false,
      },
    });

    df.fields.push({
      ...rate[0].fields[2],
      name: 'Rate',
      config: {
        links: [
          makePromLink(
            'Rate',
            buildLinkExpr(buildExpr(rateMetric, 'span_name="${__data.fields[0]}"', request)),
            datasourceUid,
            false
          ),
        ],
        decimals: 2,
      },
    });

    df.fields.push({
      ...rate[0].fields[2],
      name: '  ',
      labels: null,
      config: {
        color: {
          mode: 'continuous-BlPu',
        },
        custom: {
          cellOptions: {
            mode: BarGaugeDisplayMode.Lcd,
            type: TableCellDisplayMode.Gauge,
          },
        },
        decimals: 3,
      },
    });
  }

  if (errorRate.length > 0 && errorRate[0].fields?.length > 2) {
    const errorRateNames = errorRate[0].fields[1]?.values ?? [];
    const errorRateValues = errorRate[0].fields[2]?.values ?? [];
    let errorRateObj: Record<
      string,
      {
        value: string;
      }
    > = {};
    errorRateNames.map((name: string, index: number) => {
      errorRateObj[name] = { value: errorRateValues[index] };
    });

    const values = getRateAlignedValues({ ...rate }, errorRateObj);

    df.fields.push({
      ...errorRate[0].fields[2],
      name: 'Error Rate',
      values: values,
      config: {
        links: [
          makePromLink(
            'Error Rate',
            buildLinkExpr(buildExpr(errorRateMetric, 'span_name="${__data.fields[0]}"', request)),
            datasourceUid,
            false
          ),
        ],
        decimals: 2,
      },
    });

    df.fields.push({
      ...errorRate[0].fields[2],
      name: '   ',
      values: values,
      labels: null,
      config: {
        color: {
          mode: 'continuous-RdYlGr',
        },
        custom: {
          cellOptions: {
            mode: BarGaugeDisplayMode.Lcd,
            type: TableCellDisplayMode.Gauge,
          },
        },
        decimals: 3,
      },
    });
  }

  if (duration.length > 0) {
    let durationObj: Record<
      string,
      {
        value: string;
      }
    > = {};
    duration.forEach((d) => {
      if (d.fields.length > 1) {
        const delimiter = d.refId?.includes('span_name=~"') ? 'span_name=~"' : 'span_name="';
        const name = d.refId?.split(delimiter)[1].split('"}')[0];
        durationObj[name!] = { value: d.fields[1].values[0] };
      }
    });
    if (Object.keys(durationObj).length > 0) {
      df.fields.push({
        ...duration[0].fields[1],
        name: 'Duration (p90)',
        values: getRateAlignedValues({ ...rate }, durationObj),
        config: {
          links: [
            makePromLink(
              'Duration',
              buildLinkExpr(buildExpr(durationMetric, 'span_name="${__data.fields[0]}"', request)),
              datasourceUid,
              false
            ),
          ],
          unit: 's',
        },
      });
    }
  }

  if (df.fields.length > 0 && df.fields[0].values) {
    df.fields.push({
      name: 'Links',
      type: FieldType.string,
      values: df.fields[0].values.map(() => {
        return 'Tempo';
      }),
      config: {
        links: [makeTempoLink('Tempo', undefined, '', `\${__data.fields[0]}`, tempoDatasourceUid)],
      },
    });
  }

  return df;
}

export function buildExpr(
  metric: { expr: string; params: string[]; topk?: number },
  extraParams: string,
  request: DataQueryRequest<TempoQuery>
): string {
  let serviceMapQuery = request.targets[0]?.serviceMapQuery ?? '';
  const serviceMapQueries = Array.isArray(serviceMapQuery) ? serviceMapQuery : [serviceMapQuery];
  const metricParamsArray = serviceMapQueries.map((query) => {
    // remove surrounding curly braces from serviceMapQuery
    const serviceMapQueryMatch = query.match(/^{(.*)}$/);
    if (serviceMapQueryMatch?.length) {
      query = serviceMapQueryMatch[1];
    }
    // map serviceGraph metric tags to serviceGraphView metric tags
    query = query.replace('client', 'service').replace('server', 'service');
    return query.includes('span_name')
      ? metric.params.concat(query)
      : metric.params
          .concat(query)
          .concat(extraParams)
          .filter((item: string) => item);
  });
  const exprs = metricParamsArray.map((params) => metric.expr.replace('{}', '{' + params.join(',') + '}'));
  const expr = exprs.join(' OR ');
  if (metric.topk) {
    return `topk(${metric.topk}, ${expr})`;
  }
  return expr;
}

export function buildLinkExpr(expr: string) {
  // don't want top 5 or by span name in links
  expr = expr.replace('topk(5, ', '').replace(' by (span_name))', '');
  return expr.replace('__range', '__rate_interval');
}

// query result frames can come back in any order
// here we align the table col values to the same row name (rateName) across the table
export function getRateAlignedValues(
  rateResp: DataQueryResponseData[],
  objToAlign: { [x: string]: { value: string } }
) {
  const rateNames = rateResp[0]?.fields[1]?.values ?? [];
  let values: string[] = [];

  for (let i = 0; i < rateNames.length; i++) {
    if (Object.keys(objToAlign).includes(rateNames[i])) {
      values.push(objToAlign[rateNames[i]].value);
    } else {
      values.push('0');
    }
  }

  return values;
}

export function makeServiceGraphViewRequest(metrics: string[]): PromQuery[] {
  return metrics.map((metric) => {
    return {
      refId: metric,
      expr: metric,
      instant: true,
    };
  });
}
