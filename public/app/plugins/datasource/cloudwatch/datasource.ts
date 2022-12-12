import { cloneDeep, find, isEmpty } from 'lodash';
import { merge, Observable, of } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  LoadingState,
  LogRowModel,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { RowContextOptions } from '../../../features/logs/components/LogRowContextProvider';

import { CloudWatchAnnotationSupport } from './annotationSupport';
import { CloudWatchAPI } from './api';
import { SQLCompletionItemProvider } from './cloudwatch-sql/completion/CompletionItemProvider';
import { isCloudWatchAnnotationQuery, isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from './guards';
import { CloudWatchLanguageProvider } from './language_provider';
import { MetricMathCompletionItemProvider } from './metric-math/completion/CompletionItemProvider';
import { CloudWatchAnnotationQueryRunner } from './query-runner/CloudWatchAnnotationQueryRunner';
import { CloudWatchLogsQueryRunner } from './query-runner/CloudWatchLogsQueryRunner';
import { CloudWatchMetricsQueryRunner } from './query-runner/CloudWatchMetricsQueryRunner';
import {
  CloudWatchAnnotationQuery,
  CloudWatchJsonData,
  CloudWatchLogsQuery,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
} from './types';
import { CloudWatchVariableSupport } from './variables';

export class CloudWatchDatasource
  extends DataSourceWithBackend<CloudWatchQuery, CloudWatchJsonData>
  implements DataSourceWithLogsContextSupport<CloudWatchLogsQuery>
{
  defaultRegion?: string;
  languageProvider: CloudWatchLanguageProvider;
  sqlCompletionItemProvider: SQLCompletionItemProvider;
  metricMathCompletionItemProvider: MetricMathCompletionItemProvider;

  type = 'cloudwatch';

  private metricsQueryRunner: CloudWatchMetricsQueryRunner;
  private annotationQueryRunner: CloudWatchAnnotationQueryRunner;
  logsQueryRunner: CloudWatchLogsQueryRunner;
  api: CloudWatchAPI;

  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    readonly templateSrv: TemplateSrv = getTemplateSrv(),
    timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.api = new CloudWatchAPI(instanceSettings, templateSrv);
    this.languageProvider = new CloudWatchLanguageProvider(this);
    this.sqlCompletionItemProvider = new SQLCompletionItemProvider(this.api, this.templateSrv);
    this.metricMathCompletionItemProvider = new MetricMathCompletionItemProvider(this.api, this.templateSrv);
    this.metricsQueryRunner = new CloudWatchMetricsQueryRunner(instanceSettings, templateSrv);
    this.logsQueryRunner = new CloudWatchLogsQueryRunner(instanceSettings, templateSrv, timeSrv);
    this.annotationQueryRunner = new CloudWatchAnnotationQueryRunner(instanceSettings, templateSrv);
    this.variables = new CloudWatchVariableSupport(this.api);
    this.annotations = CloudWatchAnnotationSupport;
  }

  filterQuery(query: CloudWatchQuery) {
    return query.hide !== true || (isCloudWatchMetricsQuery(query) && query.id !== '');
  }

  query(options: DataQueryRequest<CloudWatchQuery>): Observable<DataQueryResponse> {
    options = cloneDeep(options);

    let queries = options.targets.filter(this.filterQuery);

    const logQueries: CloudWatchLogsQuery[] = [];
    const metricsQueries: CloudWatchMetricsQuery[] = [];
    const annotationQueries: CloudWatchAnnotationQuery[] = [];

    queries.forEach((query) => {
      if (isCloudWatchAnnotationQuery(query)) {
        annotationQueries.push(query);
      } else if (isCloudWatchLogsQuery(query)) {
        logQueries.push(query);
      } else {
        metricsQueries.push(query);
      }
    });

    const dataQueryResponses: Array<Observable<DataQueryResponse>> = [];
    if (logQueries.length) {
      dataQueryResponses.push(this.logsQueryRunner.handleLogQueries(logQueries, options));
    }

    if (metricsQueries.length) {
      dataQueryResponses.push(this.metricsQueryRunner.handleMetricQueries(metricsQueries, options));
    }

    if (annotationQueries.length) {
      dataQueryResponses.push(this.annotationQueryRunner.handleAnnotationQuery(annotationQueries, options));
    }
    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(dataQueryResponses)) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }

    return merge(...dataQueryResponses);
  }

  interpolateVariablesInQueries(queries: CloudWatchQuery[], scopedVars: ScopedVars): CloudWatchQuery[] {
    if (!queries.length) {
      return queries;
    }

    return queries.map((query) => ({
      ...query,
      region: this.metricsQueryRunner.replaceVariableAndDisplayWarningIfMulti(
        this.getActualRegion(query.region),
        scopedVars
      ),
      ...(isCloudWatchMetricsQuery(query) &&
        this.metricsQueryRunner.interpolateMetricsQueryVariables(query, scopedVars)),
    }));
  }

  getLogRowContext = async (
    row: LogRowModel,
    context?: RowContextOptions,
    query?: CloudWatchLogsQuery
  ): Promise<{ data: DataFrame[] }> => {
    return this.logsQueryRunner.getLogRowContext(row, context, query);
  };

  targetContainsTemplate(target: any) {
    return (
      this.templateSrv.containsTemplate(target.region) ||
      this.templateSrv.containsTemplate(target.namespace) ||
      this.templateSrv.containsTemplate(target.metricName) ||
      this.templateSrv.containsTemplate(target.expression!) ||
      target.logGroupNames?.some((logGroup: string) => this.templateSrv.containsTemplate(logGroup)) ||
      find(target.dimensions, (v, k) => this.templateSrv.containsTemplate(k) || this.templateSrv.containsTemplate(v))
    );
  }

  showContextToggle() {
    return true;
  }

  getQueryDisplayText(query: CloudWatchQuery) {
    if (query.queryMode === 'Logs') {
      return query.expression ?? '';
    } else {
      return JSON.stringify(query);
    }
  }

  // public
  getVariables() {
    return this.api.getVariables();
  }

  getActualRegion(region?: string) {
    if (region === 'default' || region === undefined || region === '') {
      return this.defaultRegion ?? '';
    }
    return region;
  }
}
