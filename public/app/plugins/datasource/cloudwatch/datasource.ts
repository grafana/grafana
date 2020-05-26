import React from 'react';
import angular from 'angular';
import _ from 'lodash';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { AppNotificationTimeout } from 'app/types';
import { store } from 'app/store/store';
import kbn from 'app/core/utils/kbn';
import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateMath,
  ScopedVars,
  TimeRange,
  DataFrame,
  DataQueryResponse,
  LoadingState,
  toDataFrame,
  LogRowModel,
} from '@grafana/data';
import { getBackendSrv, toDataQueryResponse } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ThrottlingErrorMessage } from './components/ThrottlingErrorMessage';
import memoizedDebounce from './memoizedDebounce';
import {
  CloudWatchQuery,
  CloudWatchJsonData,
  CloudWatchMetricsQuery,
  CloudWatchLogsQuery,
  CloudWatchLogsQueryStatus,
  DescribeLogGroupsRequest,
  TSDBResponse,
  MetricRequest,
  GetLogGroupFieldsRequest,
  GetLogGroupFieldsResponse,
  LogAction,
  GetLogEventsRequest,
  MetricQuery,
} from './types';
import { from, empty, Observable } from 'rxjs';
import { delay, expand, map, mergeMap, tap, finalize, catchError } from 'rxjs/operators';
import { CloudWatchLanguageProvider } from './language_provider';

import { VariableWithMultiSupport } from 'app/features/templating/types';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import { AwsUrl, encodeUrl } from './aws_url';

const TSDB_QUERY_ENDPOINT = '/api/tsdb/query';

// Constants also defined in tsdb/cloudwatch/cloudwatch.go
const LOG_IDENTIFIER_INTERNAL = '__log__grafana_internal__';
const LOGSTREAM_IDENTIFIER_INTERNAL = '__logstream__grafana_internal__';

const displayAlert = (datasourceName: string, region: string) =>
  store.dispatch(
    notifyApp(
      createErrorNotification(
        `CloudWatch request limit reached in ${region} for data source ${datasourceName}`,
        '',
        React.createElement(ThrottlingErrorMessage, { region }, null)
      )
    )
  );

const displayCustomError = (title: string, message: string) =>
  store.dispatch(notifyApp(createErrorNotification(title, message)));

// TODO: Temporary times here, could just change to some fixed number.
export const MAX_ATTEMPTS = 8;
const POLLING_TIMES = [100, 200, 500, 1000];

export class CloudWatchDatasource extends DataSourceApi<CloudWatchQuery, CloudWatchJsonData> {
  type: any;
  proxyUrl: any;
  defaultRegion: any;
  standardStatistics: any;
  datasourceName: string;
  debouncedAlert: (datasourceName: string, region: string) => void;
  debouncedCustomAlert: (title: string, message: string) => void;
  logQueries: Record<string, { id: string; region: string }>;
  languageProvider: CloudWatchLanguageProvider;

  /** @ngInject */
  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    private templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    super(instanceSettings);
    this.type = 'cloudwatch';
    this.proxyUrl = instanceSettings.url;
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.datasourceName = instanceSettings.name;
    this.standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];
    this.debouncedAlert = memoizedDebounce(displayAlert, AppNotificationTimeout.Error);
    this.debouncedCustomAlert = memoizedDebounce(displayCustomError, AppNotificationTimeout.Error);
    this.logQueries = {};

    this.languageProvider = new CloudWatchLanguageProvider(this);
  }

  query(options: DataQueryRequest<CloudWatchQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    options = angular.copy(options);

    const firstTarget = options.targets[0];

    let queries = options.targets.filter(item => item.id !== '' || item.hide !== true);

    if (firstTarget.queryMode === 'Logs') {
      const logQueries: CloudWatchLogsQuery[] = queries.filter(item => item.queryMode === 'Logs') as any;

      const validLogQueries = logQueries.filter(item => item.logGroupNames?.length);
      if (logQueries.length > validLogQueries.length) {
        return Promise.resolve({ data: [], error: { message: 'Log group is required' } });
      }

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(validLogQueries)) {
        return Promise.resolve({ data: [] });
      }

      const queryParams = validLogQueries.map((target: CloudWatchLogsQuery) => ({
        queryString: target.expression,
        refId: target.refId,
        logGroupNames: target.logGroupNames,
        region: this.replace(this.getActualRegion(target.region), options.scopedVars, true, 'region'),
      }));

      return this.makeLogActionRequest('StartQuery', queryParams, options.scopedVars).pipe(
        mergeMap(dataFrames =>
          this.logsQuery(
            dataFrames.map(dataFrame => ({
              queryId: dataFrame.fields[0].values.get(0),
              region: dataFrame.meta?.custom?.['Region'] ?? 'default',
              refId: dataFrame.refId!,
              statsGroups: (options.targets.find(target => target.refId === dataFrame.refId)! as CloudWatchLogsQuery)
                .statsGroups,
            }))
          )
        ),
        map(response => this.addDataLinksToLogsResponse(response, options))
      );
    }

    const metricQueries: MetricQuery[] = options.targets
      .filter(
        item =>
          item.queryMode !== 'Logs' &&
          ((!!item.region && !!item.namespace && !!item.metricName && !_.isEmpty(item.statistics)) ||
            item.expression?.length > 0)
      )
      .map(
        (item: CloudWatchMetricsQuery): MetricQuery => {
          item.region = this.replace(this.getActualRegion(item.region), options.scopedVars, true, 'region');
          item.namespace = this.replace(item.namespace, options.scopedVars, true, 'namespace');
          item.metricName = this.replace(item.metricName, options.scopedVars, true, 'metric name');
          item.dimensions = this.convertDimensionFormat(item.dimensions, options.scopedVars);
          item.statistics = item.statistics.map(stat => this.replace(stat, options.scopedVars, true, 'statistics'));
          item.period = String(this.getPeriod(item, options)); // use string format for period in graph query, and alerting
          item.id = this.templateSrv.replace(item.id, options.scopedVars);
          item.expression = this.templateSrv.replace(item.expression, options.scopedVars);

          // valid ExtendedStatistics is like p90.00, check the pattern
          const hasInvalidStatistics = item.statistics.some(s => {
            if (s.indexOf('p') === 0) {
              const matches = /^p\d{2}(?:\.\d{1,2})?$/.exec(s);
              return !matches || matches[0] !== s;
            }

            return false;
          });

          if (hasInvalidStatistics) {
            throw { message: 'Invalid extended statistics' };
          }

          return {
            refId: item.refId,
            intervalMs: options.intervalMs,
            maxDataPoints: options.maxDataPoints,
            datasourceId: this.id,
            type: 'timeSeriesQuery',
            ...item,
          };
        }
      );

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(metricQueries)) {
      return Promise.resolve({ data: [] });
    }

    const request = {
      from: options?.range?.from.valueOf().toString(),
      to: options?.range?.to.valueOf().toString(),
      queries: metricQueries,
    };

    return this.performTimeSeriesQuery(request, options.range);
  }

  logsQuery(
    queryParams: Array<{ queryId: string; refId: string; limit?: number; region: string; statsGroups?: string[] }>
  ): Observable<DataQueryResponse> {
    this.logQueries = {};
    queryParams.forEach(param => {
      this.logQueries[param.refId] = { id: param.queryId, region: param.region };
    });
    let prevRecordsMatched: Record<string, number> = {};

    return withTeardown(
      this.makeLogActionRequest('GetQueryResults', queryParams).pipe(
        expand((dataFrames, i) => {
          const allFramesCompleted = dataFrames.every(
            dataFrame => dataFrame.meta?.custom?.['Status'] === CloudWatchLogsQueryStatus.Complete
          );
          return allFramesCompleted
            ? empty()
            : this.makeLogActionRequest('GetQueryResults', queryParams).pipe(
                map(frames => {
                  let moreRecordsMatched = false;
                  for (const frame of frames) {
                    const recordsMatched = frame.meta?.custom?.['Statistics']['RecordsMatched'];
                    if (recordsMatched > (prevRecordsMatched[frame.refId!] ?? 0)) {
                      moreRecordsMatched = true;
                    }
                    prevRecordsMatched[frame.refId!] = recordsMatched;
                  }
                  const noProgressMade = i >= MAX_ATTEMPTS - 2 && !moreRecordsMatched;
                  if (noProgressMade) {
                    for (const frame of frames) {
                      _.set(frame, 'meta.custom.Status', CloudWatchLogsQueryStatus.Complete);
                    }
                  }

                  return frames;
                }),
                delay(POLLING_TIMES[Math.min(i, POLLING_TIMES.length - 1)])
              );
        }),
        tap(dataFrames => {
          dataFrames.forEach((dataframe, i) => {
            if (
              [
                CloudWatchLogsQueryStatus.Complete,
                CloudWatchLogsQueryStatus.Cancelled,
                CloudWatchLogsQueryStatus.Failed,
              ].includes(dataframe.meta?.custom?.['Status']) &&
              this.logQueries.hasOwnProperty(dataframe.refId!)
            ) {
              delete this.logQueries[dataframe.refId!];
            }
          });
        }),
        map(dataFrames => ({
          data: dataFrames,
          key: 'test-key',
          state: dataFrames.every(
            dataFrame => dataFrame.meta?.custom?.['Status'] === CloudWatchLogsQueryStatus.Complete
          )
            ? LoadingState.Done
            : LoadingState.Loading,
        }))
      ),
      () => this.stopQueries()
    );
  }

  private addDataLinksToLogsResponse(response: DataQueryResponse, options: DataQueryRequest<CloudWatchQuery>) {
    for (const dataFrame of response.data as DataFrame[]) {
      const range = this.timeSrv.timeRange();
      const start = range.from.toISOString();
      const end = range.to.toISOString();

      const curTarget = options.targets.find(target => target.refId === dataFrame.refId) as CloudWatchLogsQuery;
      const urlProps: AwsUrl = {
        end,
        start,
        timeType: 'ABSOLUTE',
        tz: 'UTC',
        editorString: curTarget.expression,
        isLiveTail: false,
        source: curTarget.logGroupNames,
      };

      const encodedUrl = encodeUrl(
        urlProps,
        this.getActualRegion(this.replace(curTarget.region, options.scopedVars, true, 'region'))
      );

      for (const field of dataFrame.fields) {
        field.config.links = [
          {
            url: encodedUrl,
            title: 'View in CloudWatch console',
            targetBlank: true,
          },
        ];
      }
    }

    return response;
  }

  stopQueries() {
    if (Object.keys(this.logQueries).length > 0) {
      this.makeLogActionRequest(
        'StopQuery',
        Object.values(this.logQueries).map(logQuery => ({ queryId: logQuery.id, region: logQuery.region })),
        undefined,
        false
      ).pipe(
        finalize(() => {
          this.logQueries = {};
        })
      );
    }
  }

  async describeLogGroups(params: DescribeLogGroupsRequest): Promise<string[]> {
    const dataFrames = await this.makeLogActionRequest('DescribeLogGroups', [params]).toPromise();

    const logGroupNames = dataFrames[0]?.fields[0]?.values.toArray() ?? [];
    return logGroupNames;
  }

  async getLogGroupFields(params: GetLogGroupFieldsRequest): Promise<GetLogGroupFieldsResponse> {
    const dataFrames = await this.makeLogActionRequest('GetLogGroupFields', [params]).toPromise();

    const fieldNames = dataFrames[0].fields[0].values.toArray();
    const fieldPercentages = dataFrames[0].fields[1].values.toArray();
    const getLogGroupFieldsResponse = {
      logGroupFields: fieldNames.map((val, i) => ({ name: val, percent: fieldPercentages[i] })) ?? [],
    };

    return getLogGroupFieldsResponse;
  }

  getLogRowContext = async (
    row: LogRowModel,
    { limit = 10, direction = 'BACKWARD' }: RowContextOptions = {}
  ): Promise<{ data: DataFrame[] }> => {
    let logStreamField = null;
    let logField = null;

    for (const field of row.dataFrame.fields) {
      if (field.name === LOGSTREAM_IDENTIFIER_INTERNAL) {
        logStreamField = field;
        if (logField !== null) {
          break;
        }
      } else if (field.name === LOG_IDENTIFIER_INTERNAL) {
        logField = field;
        if (logStreamField !== null) {
          break;
        }
      }
    }

    const requestParams: GetLogEventsRequest = {
      limit,
      startFromHead: direction !== 'BACKWARD',
      logGroupName: parseLogGroupName(logField!.values.get(row.rowIndex)),
      logStreamName: logStreamField!.values.get(row.rowIndex),
    };

    if (direction === 'BACKWARD') {
      requestParams.endTime = row.timeEpochMs;
    } else {
      requestParams.startTime = row.timeEpochMs;
    }

    const dataFrames = await this.makeLogActionRequest('GetLogEvents', [requestParams]).toPromise();

    return {
      data: dataFrames,
    };
  };

  get variables() {
    return this.templateSrv.getVariables().map(v => `$${v.name}`);
  }

  getPeriod(target: CloudWatchMetricsQuery, options: any) {
    let period = this.templateSrv.replace(target.period, options.scopedVars) as any;
    if (period && period.toLowerCase() !== 'auto') {
      if (/^\d+$/.test(period)) {
        period = parseInt(period, 10);
      } else {
        period = kbn.interval_to_seconds(period);
      }

      if (period < 1) {
        period = 1;
      }
    }

    return period || '';
  }

  buildCloudwatchConsoleUrl(
    { region, namespace, metricName, dimensions, statistics, expression }: CloudWatchMetricsQuery,
    start: string,
    end: string,
    title: string,
    gmdMeta: Array<{ Expression: string; Period: string }>
  ) {
    region = this.getActualRegion(region);
    let conf = {
      view: 'timeSeries',
      stacked: false,
      title,
      start,
      end,
      region,
    } as any;

    const isSearchExpression =
      gmdMeta && gmdMeta.length && gmdMeta.every(({ Expression: expression }) => /SEARCH().*/.test(expression));
    const isMathExpression = !isSearchExpression && expression;

    if (isMathExpression) {
      return '';
    }

    if (isSearchExpression) {
      const metrics: any =
        gmdMeta && gmdMeta.length ? gmdMeta.map(({ Expression: expression }) => ({ expression })) : [{ expression }];
      conf = { ...conf, metrics };
    } else {
      conf = {
        ...conf,
        metrics: [
          ...statistics.map(stat => [
            namespace,
            metricName,
            ...Object.entries(dimensions).reduce((acc, [key, value]) => [...acc, key, value[0]], []),
            {
              stat,
              period: gmdMeta.length ? gmdMeta[0].Period : 60,
            },
          ]),
        ],
      };
    }

    return `https://${region}.console.aws.amazon.com/cloudwatch/deeplink.js?region=${region}#metricsV2:graph=${encodeURIComponent(
      JSON.stringify(conf)
    )}`;
  }

  performTimeSeriesQuery(request: MetricRequest, { from, to }: TimeRange): Promise<any> {
    return this.awsRequest(TSDB_QUERY_ENDPOINT, request)
      .then((res: TSDBResponse) => {
        if (!res.results) {
          return { data: [] };
        }
        return Object.values(request.queries).reduce(
          ({ data, error }: any, queryRequest: any) => {
            const queryResult = res.results[queryRequest.refId];
            if (!queryResult) {
              return { data, error };
            }

            const link = this.buildCloudwatchConsoleUrl(
              queryRequest,
              from.toISOString(),
              to.toISOString(),
              queryRequest.refId,
              queryResult.meta.gmdMeta
            );

            return {
              error: error || queryResult.error ? { message: queryResult.error } : null,
              data: [
                ...data,
                ...queryResult.series.map(({ name, points }: any) => {
                  const dataFrame = toDataFrame({
                    target: name,
                    datapoints: points,
                    refId: queryRequest.refId,
                    meta: queryResult.meta,
                  });
                  if (link) {
                    for (const field of dataFrame.fields) {
                      field.config.links = [
                        {
                          url: link,
                          title: 'View in CloudWatch console',
                          targetBlank: true,
                        },
                      ];
                    }
                  }
                  return dataFrame;
                }),
              ],
            };
          },
          { data: [], error: null }
        );
      })
      .catch((err: any = { data: { error: '' } }) => {
        if (/^Throttling:.*/.test(err.data.message)) {
          const failedRedIds = Object.keys(err.data.results);
          const regionsAffected = Object.values(request.queries).reduce(
            (res: string[], { refId, region }) =>
              (refId && !failedRedIds.includes(refId)) || res.includes(region) ? res : [...res, region],
            []
          ) as string[];

          regionsAffected.forEach(region => this.debouncedAlert(this.datasourceName, this.getActualRegion(region)));
        }

        if (err.data && err.data.message === 'Metric request error' && err.data.error) {
          err.data.message = err.data.error;
        }

        throw err;
      });
  }

  transformSuggestDataFromTable(suggestData: TSDBResponse) {
    return suggestData.results['metricFindQuery'].tables[0].rows.map(([text, value]) => ({
      text,
      value,
      label: value,
    }));
  }

  doMetricQueryRequest(subtype: string, parameters: any) {
    const range = this.timeSrv.timeRange();
    return this.awsRequest(TSDB_QUERY_ENDPOINT, {
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: [
        {
          refId: 'metricFindQuery',
          intervalMs: 1, // dummy
          maxDataPoints: 1, // dummy
          datasourceId: this.id,
          type: 'metricFindQuery',
          subtype: subtype,
          ...parameters,
        },
      ],
    }).then((r: TSDBResponse) => {
      return this.transformSuggestDataFromTable(r);
    });
  }

  makeLogActionRequest(
    subtype: LogAction,
    queryParams: any[],
    scopedVars?: ScopedVars,
    makeReplacements = true
  ): Observable<DataFrame[]> {
    const range = this.timeSrv.timeRange();

    const requestParams = {
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: queryParams.map((param: any) => ({
        refId: 'A',
        intervalMs: 1, // dummy
        maxDataPoints: 1, // dummy
        datasourceId: this.id,
        type: 'logAction',
        subtype: subtype,
        ...param,
      })),
    };

    if (makeReplacements) {
      requestParams.queries.forEach(query => {
        if (query.hasOwnProperty('queryString')) {
          query.queryString = this.replace(query.queryString, scopedVars, true);
        }
        query.region = this.replace(query.region, scopedVars, true, 'region');
        query.region = this.getActualRegion(query.region);
      });
    }

    const resultsToDataFrames = (val: any): DataFrame[] => toDataQueryResponse(val).data || [];

    return from(this.awsRequest(TSDB_QUERY_ENDPOINT, requestParams)).pipe(
      map(response => resultsToDataFrames({ data: response })),
      catchError(err => {
        if (err.data?.error) {
          throw err.data.error;
        }

        throw err;
      })
    );
  }

  getRegions(): Promise<Array<{ label: string; value: string; text: string }>> {
    return this.doMetricQueryRequest('regions', null).then((regions: any) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions,
    ]);
  }

  getNamespaces() {
    return this.doMetricQueryRequest('namespaces', null);
  }

  async getMetrics(namespace: string, region?: string) {
    if (!namespace) {
      return [];
    }

    return this.doMetricQueryRequest('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getDimensionKeys(namespace: string, region: string) {
    if (!namespace) {
      return [];
    }

    return this.doMetricQueryRequest('dimension_keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getDimensionValues(
    region: string,
    namespace: string,
    metricName: string,
    dimensionKey: string,
    filterDimensions: {}
  ) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.doMetricQueryRequest('dimension_values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: this.convertDimensionFormat(filterDimensions, {}),
    });

    return values;
  }

  getEbsVolumeIds(region: string, instanceId: string) {
    return this.doMetricQueryRequest('ebs_volume_ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region: string, attributeName: string, filters: any) {
    return this.doMetricQueryRequest('ec2_instance_attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: filters,
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: any) {
    return this.doMetricQueryRequest('resource_arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: tags,
    });
  }

  async metricFindQuery(query: string) {
    let region;
    let namespace;
    let metricName;
    let filterJson;

    const regionQuery = query.match(/^regions\(\)/);
    if (regionQuery) {
      return this.getRegions();
    }

    const namespaceQuery = query.match(/^namespaces\(\)/);
    if (namespaceQuery) {
      return this.getNamespaces();
    }

    const metricNameQuery = query.match(/^metrics\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (metricNameQuery) {
      namespace = metricNameQuery[1];
      region = metricNameQuery[3];
      return this.getMetrics(namespace, region);
    }

    const dimensionKeysQuery = query.match(/^dimension_keys\(([^\)]+?)(,\s?([^,]+?))?\)/);
    if (dimensionKeysQuery) {
      namespace = dimensionKeysQuery[1];
      region = dimensionKeysQuery[3];
      return this.getDimensionKeys(namespace, region);
    }

    const dimensionValuesQuery = query.match(
      /^dimension_values\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)(,\s?(.+))?\)/
    );
    if (dimensionValuesQuery) {
      region = dimensionValuesQuery[1];
      namespace = dimensionValuesQuery[2];
      metricName = dimensionValuesQuery[3];
      const dimensionKey = dimensionValuesQuery[4];
      filterJson = {};
      if (dimensionValuesQuery[6]) {
        filterJson = JSON.parse(this.templateSrv.replace(dimensionValuesQuery[6]));
      }

      return this.getDimensionValues(region, namespace, metricName, dimensionKey, filterJson);
    }

    const ebsVolumeIdsQuery = query.match(/^ebs_volume_ids\(([^,]+?),\s?([^,]+?)\)/);
    if (ebsVolumeIdsQuery) {
      region = ebsVolumeIdsQuery[1];
      const instanceId = ebsVolumeIdsQuery[2];
      return this.getEbsVolumeIds(region, instanceId);
    }

    const ec2InstanceAttributeQuery = query.match(/^ec2_instance_attribute\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (ec2InstanceAttributeQuery) {
      region = ec2InstanceAttributeQuery[1];
      const targetAttributeName = ec2InstanceAttributeQuery[2];
      filterJson = JSON.parse(this.templateSrv.replace(ec2InstanceAttributeQuery[3]));
      return this.getEc2InstanceAttribute(region, targetAttributeName, filterJson);
    }

    const resourceARNsQuery = query.match(/^resource_arns\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/);
    if (resourceARNsQuery) {
      region = resourceARNsQuery[1];
      const resourceType = resourceARNsQuery[2];
      const tagsJSON = JSON.parse(this.templateSrv.replace(resourceARNsQuery[3]));
      return this.getResourceARNs(region, resourceType, tagsJSON);
    }

    const statsQuery = query.match(/^statistics\(\)/);
    if (statsQuery) {
      return this.standardStatistics.map((s: string) => ({ value: s, label: s, text: s }));
    }

    return Promise.resolve([]);
  }

  annotationQuery(options: any) {
    const annotation = options.annotation;
    const statistics = annotation.statistics.map((s: any) => this.templateSrv.replace(s));
    const defaultPeriod = annotation.prefixMatching ? '' : '300';
    let period = annotation.period || defaultPeriod;
    period = parseInt(period, 10);
    const parameters = {
      prefixMatching: annotation.prefixMatching,
      region: this.templateSrv.replace(this.getActualRegion(annotation.region)),
      namespace: this.templateSrv.replace(annotation.namespace),
      metricName: this.templateSrv.replace(annotation.metricName),
      dimensions: this.convertDimensionFormat(annotation.dimensions, {}),
      statistics: statistics,
      period: period,
      actionPrefix: annotation.actionPrefix || '',
      alarmNamePrefix: annotation.alarmNamePrefix || '',
    };

    return this.awsRequest(TSDB_QUERY_ENDPOINT, {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        {
          refId: 'annotationQuery',
          datasourceId: this.id,
          type: 'annotationQuery',
          ...parameters,
        },
      ],
    }).then((r: TSDBResponse) => {
      return r.results['annotationQuery'].tables[0].rows.map(v => ({
        annotation: annotation,
        time: Date.parse(v[0]),
        title: v[1],
        tags: [v[2]],
        text: v[3],
      }));
    });
  }

  targetContainsTemplate(target: any) {
    return (
      this.templateSrv.variableExists(target.region) ||
      this.templateSrv.variableExists(target.namespace) ||
      this.templateSrv.variableExists(target.metricName) ||
      _.find(target.dimensions, (v, k) => {
        return this.templateSrv.variableExists(k) || this.templateSrv.variableExists(v);
      })
    );
  }

  testDatasource() {
    // use billing metrics for test
    const region = this.defaultRegion;
    const namespace = 'AWS/Billing';
    const metricName = 'EstimatedCharges';
    const dimensions = {};

    return this.getDimensionValues(region, namespace, metricName, 'ServiceName', dimensions).then(() => ({
      status: 'success',
      message: 'Data source is working',
    }));
  }

  async awsRequest(url: string, data: MetricRequest) {
    const options = {
      method: 'POST',
      url,
      data,
    };

    const result = await getBackendSrv().datasourceRequest(options);

    return result.data;
  }

  getDefaultRegion() {
    return this.defaultRegion;
  }

  getActualRegion(region?: string) {
    if (region === 'default' || region === undefined || region === '') {
      return this.getDefaultRegion();
    }
    return region;
  }

  showContextToggle() {
    return true;
  }

  convertToCloudWatchTime(date: any, roundUp: any) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.round(date.valueOf() / 1000);
  }

  convertDimensionFormat(dimensions: { [key: string]: string | string[] }, scopedVars: ScopedVars) {
    return Object.entries(dimensions).reduce((result, [key, value]) => {
      key = this.replace(key, scopedVars, true, 'dimension keys');

      if (Array.isArray(value)) {
        return { ...result, [key]: value };
      }

      const valueVar = this.templateSrv
        .getVariables()
        .find(({ name }) => name === this.templateSrv.getVariableName(value));
      if (valueVar) {
        if (((valueVar as unknown) as VariableWithMultiSupport).multi) {
          const values = this.templateSrv.replace(value, scopedVars, 'pipe').split('|');
          return { ...result, [key]: values };
        }
        return { ...result, [key]: [this.templateSrv.replace(value, scopedVars)] };
      }

      return { ...result, [key]: [value] };
    }, {});
  }

  replace(
    target: string,
    scopedVars: ScopedVars | undefined,
    displayErrorIfIsMultiTemplateVariable?: boolean,
    fieldName?: string
  ) {
    if (displayErrorIfIsMultiTemplateVariable) {
      const variable = this.templateSrv
        .getVariables()
        .find(({ name }) => name === this.templateSrv.getVariableName(target));
      if (variable && ((variable as unknown) as VariableWithMultiSupport).multi) {
        this.debouncedCustomAlert(
          'CloudWatch templating error',
          `Multi template variables are not supported for ${fieldName || target}`
        );
      }
    }

    return this.templateSrv.replace(target, scopedVars);
  }

  getQueryDisplayText(query: CloudWatchQuery) {
    if (query.queryMode === 'Logs') {
      return query.expression;
    } else {
      return JSON.stringify(query);
    }
  }
}

function withTeardown<T = any>(observable: Observable<T>, onUnsubscribe: () => void): Observable<T> {
  return new Observable<T>(subscriber => {
    const innerSub = observable.subscribe({
      next: val => subscriber.next(val),
      error: err => subscriber.next(err),
      complete: () => subscriber.complete(),
    });

    return () => {
      innerSub.unsubscribe();
      onUnsubscribe();
    };
  });
}

function parseLogGroupName(logIdentifier: string): string {
  const colonIndex = logIdentifier.lastIndexOf(':');
  return logIdentifier.substr(colonIndex + 1);
}
