import { groupBy, identity, pick, pickBy, startCase } from 'lodash';
import { EMPTY, from, lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, map, mergeMap, toArray } from 'rxjs/operators';
import semver from 'semver';

import {
  CoreApp,
  DataFrame,
  DataFrameDTO,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  isValidGoDuration,
  LoadingState,
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

import { generateQueryFromFilters } from './SearchTraceQLEditor/utils';
import { TempoVariableQuery, TempoVariableQueryType } from './VariableQueryEditor';
import { LokiOptions } from './_importedDependencies/datasources/loki/types';
import { PrometheusDatasource, PromQuery } from './_importedDependencies/datasources/prometheus/types';
import { TraceqlFilter, TraceqlSearchScope } from './dataquery.gen';
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
  createTableFrameFromSearch,
  formatTraceQLMetrics,
  formatTraceQLResponse,
  transformFromOTLP as transformFromOTEL,
  transformTrace,
  transformTraceList,
} from './resultTransformer';
import { doTempoChannelStream } from './streaming';
import { SearchQueryParams, TempoJsonData, TempoQuery } from './types';
import { getErrorMessage } from './utils';
import { TempoVariableSupport } from './variables';

export const DEFAULT_LIMIT = 20;
export const DEFAULT_SPSS = 3; // spans per span set

enum FeatureName {
  streaming = 'streaming',
}

/* Map, for each feature (e.g., streaming), the minimum Tempo version required to have that
 ** feature available. If the running Tempo instance on the user's backend is older than the
 ** target version, the feature is disabled in Grafana (frontend).
 */
const featuresToTempoVersion = {
  [FeatureName.streaming]: '2.2.0',
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
  lokiSearch?: {
    datasourceUid?: string;
  };
  traceQuery?: {
    timeShiftEnabled?: boolean;
    spanStartTimeShift?: string;
    spanEndTimeShift?: string;
  };
  uploadedJson?: string | null = null;
  spanBar?: SpanBarOptions;
  languageProvider: TempoLanguageProvider;

  // The version of Tempo running on the backend. `null` if we cannot retrieve it for whatever reason
  tempoVersion?: string | null;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<TempoJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);

    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.serviceMap = instanceSettings.jsonData.serviceMap;
    this.search = instanceSettings.jsonData.search;
    this.nodeGraph = instanceSettings.jsonData.nodeGraph;
    this.lokiSearch = instanceSettings.jsonData.lokiSearch;
    this.traceQuery = instanceSettings.jsonData.traceQuery;
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
  getTagValues(options: DataSourceGetTagValuesOptions): Promise<Array<{ text: string }>> {
    return this.labelValuesQuery(options.key.replace(/^(resource|span)\./, ''));
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
  private isFeatureAvailable(featureName: FeatureName) {
    // We know for old Tempo instances we don't know their version, so resort to default
    const actualVersion = this.tempoVersion ?? defaultTempoVersion;

    try {
      return semver.gte(actualVersion, featuresToTempoVersion[featureName]);
    } catch {
      // We assume we are on a development and recent branch, thus we enable all features
      return true;
    }
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const targets: { [type: string]: TempoQuery[] } = groupBy(filteredTargets, (t) => t.queryType || 'traceql');

    if (targets.clear) {
      return of({ data: [], state: LoadingState.Done });
    }

    const logsDatasourceUid = this.getLokiSearchDS();

    // Run search queries on linked datasource
    if (logsDatasourceUid && targets.search?.length > 0) {
      reportInteraction('grafana_traces_loki_search_queried', {
        datasourceType: 'tempo',
        app: options.app ?? '',
        grafana_version: config.buildInfo.version,
        hasLinkedQueryExpr:
          targets.search[0].linkedQuery?.expr && targets.search[0].linkedQuery?.expr !== '' ? true : false,
      });

      const dsSrv = getDataSourceSrv();
      subQueries.push(
        from(dsSrv.get(logsDatasourceUid)).pipe(
          mergeMap((linkedDatasource: DataSourceApi) => {
            // Wrap linked query into a data request based on original request
            const linkedRequest: DataQueryRequest = { ...options, targets: targets.search.map((t) => t.linkedQuery!) };
            // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
            const settings: DataSourceInstanceSettings<LokiOptions> = (linkedDatasource as TempoDatasource)
              .instanceSettings;
            const traceLinkMatcher: string[] =
              settings.jsonData.derivedFields
                ?.filter((field) => field.datasourceUid === this.uid && field.matcherRegex)
                .map((field) => field.matcherRegex) || [];

            if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
              return throwError(
                () =>
                  new Error(
                    'No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.'
                  )
              );
            } else {
              const response = linkedDatasource.query(linkedRequest);
              return from(response).pipe(
                map((response) =>
                  response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkMatcher)
                )
              );
            }
          })
        )
      );
    }

    if (targets.nativeSearch?.length) {
      try {
        reportInteraction('grafana_traces_search_queried', {
          datasourceType: 'tempo',
          app: options.app ?? '',
          grafana_version: config.buildInfo.version,
          hasServiceName: targets.nativeSearch[0].serviceName ? true : false,
          hasSpanName: targets.nativeSearch[0].spanName ? true : false,
          resultLimit: targets.nativeSearch[0].limit ?? '',
          hasSearch: targets.nativeSearch[0].search ? true : false,
          minDuration: targets.nativeSearch[0].minDuration ?? '',
          maxDuration: targets.nativeSearch[0].maxDuration ?? '',
        });

        const timeRange = { startTime: options.range.from.unix(), endTime: options.range.to.unix() };
        const query = this.applyVariables(targets.nativeSearch[0], options.scopedVars);
        const searchQuery = this.buildSearchQuery(query, timeRange);
        subQueries.push(
          this._request('/api/search', searchQuery).pipe(
            map((response) => {
              return {
                data: [createTableFrameFromSearch(response.data.traces, this.instanceSettings)],
              };
            }),
            catchError((err) => {
              return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
            })
          )
        );
      } catch (error) {
        return of({ error: { message: error instanceof Error ? error.message : 'Unknown error occurred' }, data: [] });
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
            });
            subQueries.push(this.handleTraceQlMetricsQuery(options, queryValue));
          } else {
            reportInteraction('grafana_traces_traceql_queried', {
              datasourceType: 'tempo',
              app: options.app ?? '',
              grafana_version: config.buildInfo.version,
              query: queryValue ?? '',
              streaming: config.featureToggles.traceQLStreaming,
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
            subQueries.push(
              this.handleMetricsSummary(appliedQuery, generateQueryFromFilters(appliedQuery.filters), options)
            );
          }
        }

        const traceqlSearchTargets = config.featureToggles.metricsSummary
          ? targets.traceqlSearch.filter((t) => !this.hasGroupBy(t))
          : targets.traceqlSearch;
        if (traceqlSearchTargets.length > 0) {
          const appliedQuery = this.applyVariables(traceqlSearchTargets[0], options.scopedVars);
          const queryValueFromFilters = generateQueryFromFilters(appliedQuery.filters);

          reportInteraction('grafana_traces_traceql_search_queried', {
            datasourceType: 'tempo',
            app: options.app ?? '',
            grafana_version: config.buildInfo.version,
            query: queryValueFromFilters ?? '',
            streaming: config.featureToggles.traceQLStreaming,
          });

          if (config.featureToggles.traceQLStreaming && this.isFeatureAvailable(FeatureName.streaming)) {
            subQueries.push(this.handleStreamingSearch(options, traceqlSearchTargets, queryValueFromFilters));
          } else {
            subQueries.push(
              this._request('/api/search', {
                q: queryValueFromFilters,
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

  isTraceQlMetricsQuery(query: string): boolean {
    // Check whether this is a metrics query by checking if it contains a metrics function
    const metricsFnRegex =
      /\|\s*(rate|count_over_time|avg_over_time|max_over_time|min_over_time|quantile_over_time)\s*\(/;
    return !!query.trim().match(metricsFnRegex);
  }

  isTraceIdQuery(query: string): boolean {
    const hexOnlyRegex = /^[0-9A-Fa-f]*$/;
    // Check whether this is a trace ID or traceQL query by checking if it only contains hex characters
    return !!query.trim().match(hexOnlyRegex);
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

    if (query.linkedQuery) {
      expandedQuery.linkedQuery = {
        ...query.linkedQuery,
        expr: this.templateSrv.replace(query.linkedQuery?.expr ?? '', scopedVars),
      };
    }

    if (query.filters) {
      expandedQuery.filters = query.filters.map((filter) => {
        const updatedFilter = {
          ...filter,
          tag: this.templateSrv.replace(filter.tag ?? '', scopedVars),
        };

        if (filter.value) {
          updatedFilter.value =
            typeof filter.value === 'string'
              ? this.templateSrv.replace(filter.value ?? '', scopedVars, VariableFormatID.Pipe)
              : filter.value.map((v) => this.templateSrv.replace(v ?? '', scopedVars, VariableFormatID.Pipe));
        }

        return updatedFilter;
      });
    }

    return {
      ...expandedQuery,
      query: this.templateSrv.replace(query.query ?? '', scopedVars, VariableFormatID.Pipe),
      serviceName: this.templateSrv.replace(query.serviceName ?? '', scopedVars),
      spanName: this.templateSrv.replace(query.spanName ?? '', scopedVars),
      search: this.templateSrv.replace(query.search ?? '', scopedVars),
      minDuration: this.templateSrv.replace(query.minDuration ?? '', scopedVars),
      maxDuration: this.templateSrv.replace(query.maxDuration ?? '', scopedVars),
      serviceMapQuery: Array.isArray(query.serviceMapQuery)
        ? query.serviceMapQuery.map((query) => this.templateSrv.replace(query, scopedVars))
        : this.templateSrv.replace(query.serviceMapQuery ?? '', scopedVars),
    };
  }

  handleMetricsSummary = (target: TempoQuery, query: string, options: DataQueryRequest<TempoQuery>) => {
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
              message: getErrorMessage(
                `No summary data for '${groupBy}'. Note: the metrics summary API only considers spans of kind = server. You can check if the attributes exist by running a TraceQL query like { attr_key = attr_value && kind = server }`
              ),
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

    const traceRequest = this.traceIdQueryRequest(options, validTargets);

    return super.query(traceRequest).pipe(
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
    if (config.featureToggles.traceQLStreaming && this.isFeatureAvailable(FeatureName.streaming)) {
      return this.handleStreamingSearch(options, targets.traceql, queryValue);
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

  handleTraceQlMetricsQuery = (
    options: DataQueryRequest<TempoQuery>,
    queryValue: string
  ): Observable<DataQueryResponse> => {
    return this._request('/api/metrics/query_range', {
      query: queryValue,
      start: options.range.from.unix(),
      end: options.range.to.unix(),
    }).pipe(
      map((response) => {
        return {
          data: formatTraceQLMetrics(response.data),
        };
      }),
      catchError((err) => {
        return of({ error: { message: getErrorMessage(err.data.message) }, data: [] });
      })
    );
  };

  traceIdQueryRequest(options: DataQueryRequest<TempoQuery>, targets: TempoQuery[]): DataQueryRequest<TempoQuery> {
    const request = {
      ...options,
      targets,
    };

    if (this.traceQuery?.timeShiftEnabled) {
      request.range = options.range && {
        ...options.range,
        from: options.range.from.subtract(
          rangeUtil.intervalToMs(this.traceQuery?.spanStartTimeShift || '30m'),
          'milliseconds'
        ),
        to: options.range.to.add(rangeUtil.intervalToMs(this.traceQuery?.spanEndTimeShift || '30m'), 'milliseconds'),
      };
    } else {
      request.range = { from: dateTime(0), to: dateTime(0), raw: { from: dateTime(0), to: dateTime(0) } };
    }

    return request;
  }

  // This function can probably be simplified by avoiding passing both `targets` and `query`,
  // since `query` is built from `targets`, if you look at how this function is currently called
  handleStreamingSearch(
    options: DataQueryRequest<TempoQuery>,
    targets: TempoQuery[],
    query: string
  ): Observable<DataQueryResponse> {
    if (query === '') {
      return EMPTY;
    }

    return merge(
      ...targets.map((target) =>
        doTempoChannelStream(
          { ...target, query },
          this, // the datasource
          options,
          this.instanceSettings
        )
      )
    );
  }

  async metadataRequest(url: string, params = {}) {
    return await lastValueFrom(this._request(url, params, { method: 'GET', hideFromInspector: true }));
  }

  private _request(
    apiUrl: string,
    data?: unknown,
    options?: Partial<BackendSrvRequest>
  ): Observable<Record<string, any>> {
    const params = data ? urlUtil.serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = { ...options, url };

    return getBackendSrv().fetch(req);
  }

  async testDatasource(): Promise<TestDataSourceResponse> {
    const options: BackendSrvRequest = {
      headers: {},
      method: 'GET',
      url: `${this.instanceSettings.url}/api/echo`,
    };

    return await lastValueFrom(
      getBackendSrv()
        .fetch(options)
        .pipe(
          mergeMap(() => {
            return of({ status: 'success', message: 'Data source successfully connected.' });
          }),
          catchError((err) => {
            return of({ status: 'error', message: getErrorMessage(err.data.message, 'Unable to connect with Tempo') });
          })
        )
    );
  }

  getQueryDisplayText(query: TempoQuery) {
    if (query.queryType !== 'nativeSearch') {
      return query.query ?? '';
    }

    const keys: Array<
      keyof Pick<TempoQuery, 'serviceName' | 'spanName' | 'search' | 'minDuration' | 'maxDuration' | 'limit'>
    > = ['serviceName', 'spanName', 'search', 'minDuration', 'maxDuration', 'limit'];
    return keys
      .filter((key) => query[key])
      .map((key) => `${startCase(key)}: ${query[key]}`)
      .join(', ');
  }

  buildSearchQuery(query: TempoQuery, timeRange?: { startTime: number; endTime?: number }): SearchQueryParams {
    let tags = query.search ?? '';

    let tempoQuery = pick(query, ['minDuration', 'maxDuration', 'limit']);
    // Remove empty properties
    tempoQuery = pickBy(tempoQuery, identity);

    if (query.serviceName) {
      tags += ` service.name="${query.serviceName}"`;
    }
    if (query.spanName) {
      tags += ` name="${query.spanName}"`;
    }

    // Set default limit
    if (!tempoQuery.limit) {
      tempoQuery.limit = DEFAULT_LIMIT;
    }

    // Validate query inputs and remove spaces if valid
    if (tempoQuery.minDuration) {
      tempoQuery.minDuration = this.templateSrv.replace(tempoQuery.minDuration ?? '');
      if (!isValidGoDuration(tempoQuery.minDuration)) {
        throw new Error('Please enter a valid min duration.');
      }
      tempoQuery.minDuration = tempoQuery.minDuration.replace(/\s/g, '');
    }
    if (tempoQuery.maxDuration) {
      tempoQuery.maxDuration = this.templateSrv.replace(tempoQuery.maxDuration ?? '');
      if (!isValidGoDuration(tempoQuery.maxDuration)) {
        throw new Error('Please enter a valid max duration.');
      }
      tempoQuery.maxDuration = tempoQuery.maxDuration.replace(/\s/g, '');
    }

    if (!Number.isInteger(tempoQuery.limit) || tempoQuery.limit <= 0) {
      throw new Error('Please enter a valid limit.');
    }

    let searchQuery: SearchQueryParams = { tags, ...tempoQuery };

    if (timeRange) {
      searchQuery.start = timeRange.startTime;
      searchQuery.end = timeRange.endTime;
    }

    return searchQuery;
  }

  // Get linked loki search datasource. Fall back to legacy loki search/trace to logs config
  getLokiSearchDS = (): string | undefined => {
    const legacyLogsDatasourceUid =
      this.tracesToLogs?.lokiSearch !== false && this.lokiSearch === undefined
        ? this.tracesToLogs?.datasourceUid
        : undefined;
    return this.lokiSearch?.datasourceUid ?? legacyLogsDatasourceUid;
  };
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

      const serviceGraphView = getServiceGraphView(
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

export function getEscapedSpanNames(values: string[]) {
  return values.map((value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'));
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
      makeTempoLink('View traces', `\${${tempoField}}`, '', tempoDatasourceUid),
    ],
  };
}

export function makeTempoLink(title: string, serviceName: string, spanName: string, datasourceUid: string) {
  let query: TempoQuery = { refId: 'A', queryType: 'traceqlSearch', filters: [] };
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

function makePromServiceMapRequest(options: DataQueryRequest<TempoQuery>): DataQueryRequest<PromQuery> {
  return {
    ...options,
    targets: serviceMapMetrics.map((metric) => {
      const { serviceMapQuery, serviceMapIncludeNamespace: serviceMapIncludeNamespace } = options.targets[0];
      const extraSumByFields = serviceMapIncludeNamespace ? ', client_service_namespace, server_service_namespace' : '';
      const queries = Array.isArray(serviceMapQuery) ? serviceMapQuery : [serviceMapQuery];
      const subExprs = queries.map(
        (query) => `sum by (client, server${extraSumByFields}) (rate(${metric}${query || ''}[$__range]))`
      );
      return {
        format: 'table',
        refId: metric,
        // options.targets[0] is not correct here, but not sure what should happen if you have multiple queries for
        // service map at the same time anyway
        expr: subExprs.join(' OR '),
        instant: true,
      };
    }),
  };
}

function getServiceGraphView(
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
    let errorRateObj: any = {};
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
    let durationObj: any = {};
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
        links: [makeTempoLink('Tempo', '', `\${__data.fields[0]}`, tempoDatasourceUid)],
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
