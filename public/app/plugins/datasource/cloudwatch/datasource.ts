import { cloneDeep, find, isEmpty } from 'lodash';
import { merge, Observable, of } from 'rxjs';

import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  LoadingState,
  LogRowContextOptions,
  LogRowModel,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, TemplateSrv, getTemplateSrv } from '@grafana/runtime';

import { CloudWatchAnnotationSupport } from './annotationSupport';
import { DEFAULT_METRICS_QUERY, getDefaultLogsQuery } from './defaultQueries';
import { isCloudWatchAnnotationQuery, isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from './guards';
import { CloudWatchLogsLanguageProvider } from './language/cloudwatch-logs/CloudWatchLogsLanguageProvider';
import {
  LogsSQLCompletionItemProvider,
  LogsSQLCompletionItemProviderFunc,
} from './language/cloudwatch-logs-sql/completion/CompletionItemProvider';
import {
  PPLCompletionItemProvider,
  PPLCompletionItemProviderFunc,
} from './language/cloudwatch-ppl/completion/PPLCompletionItemProvider';
import { SQLCompletionItemProvider } from './language/cloudwatch-sql/completion/CompletionItemProvider';
import {
  LogsCompletionItemProvider,
  LogsCompletionItemProviderFunc,
  queryContext,
} from './language/logs/completion/CompletionItemProvider';
import { MetricMathCompletionItemProvider } from './language/metric-math/completion/CompletionItemProvider';
import { CloudWatchAnnotationQueryRunner } from './query-runner/CloudWatchAnnotationQueryRunner';
import { CloudWatchLogsQueryRunner } from './query-runner/CloudWatchLogsQueryRunner';
import { CloudWatchMetricsQueryRunner } from './query-runner/CloudWatchMetricsQueryRunner';
import { ResourcesAPI } from './resources/ResourcesAPI';
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
  languageProvider: CloudWatchLogsLanguageProvider;
  sqlCompletionItemProvider: SQLCompletionItemProvider;
  metricMathCompletionItemProvider: MetricMathCompletionItemProvider;
  defaultLogGroups?: string[];
  logsSqlCompletionItemProviderFunc: (queryContext: queryContext) => LogsSQLCompletionItemProvider;
  logsCompletionItemProviderFunc: (queryContext: queryContext) => LogsCompletionItemProvider;
  pplCompletionItemProviderFunc: (queryContext: queryContext) => PPLCompletionItemProvider;

  type = 'cloudwatch';

  private metricsQueryRunner: CloudWatchMetricsQueryRunner;
  private annotationQueryRunner: CloudWatchAnnotationQueryRunner;
  logsQueryRunner: CloudWatchLogsQueryRunner;
  resources: ResourcesAPI;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.resources = new ResourcesAPI(instanceSettings, templateSrv);
    this.languageProvider = new CloudWatchLogsLanguageProvider(this);
    this.sqlCompletionItemProvider = new SQLCompletionItemProvider(this.resources, this.templateSrv);
    this.metricsQueryRunner = new CloudWatchMetricsQueryRunner(instanceSettings, templateSrv);
    this.logsQueryRunner = new CloudWatchLogsQueryRunner(instanceSettings, templateSrv);
    this.annotationQueryRunner = new CloudWatchAnnotationQueryRunner(instanceSettings, templateSrv);
    this.variables = new CloudWatchVariableSupport(this.resources);
    this.annotations = CloudWatchAnnotationSupport;
    this.defaultLogGroups = instanceSettings.jsonData.defaultLogGroups;

    this.metricMathCompletionItemProvider = new MetricMathCompletionItemProvider(this.resources, this.templateSrv);
    this.logsCompletionItemProviderFunc = LogsCompletionItemProviderFunc(this.resources, this.templateSrv);
    this.logsSqlCompletionItemProviderFunc = LogsSQLCompletionItemProviderFunc(this.resources, templateSrv);
    this.pplCompletionItemProviderFunc = PPLCompletionItemProviderFunc(this.resources, this.templateSrv);
    this.supportsAdjustableWindow = true;
  }

  // Flag marking datasource as supporting adjusting the time range window in the logs context window: https://github.com/grafana/grafana/pull/109901
  public supportsAdjustableWindow;

  filterQuery(query: CloudWatchQuery) {
    return query.hide !== true || (isCloudWatchMetricsQuery(query) && query.id !== '');
  }

  // reminder: when queries are made on the backend through alerting they will not go through this function
  // we have duplicated code here to retry queries on the frontend so that the we can show partial results to users
  // but ultimately anytime we add special error handling or logic retrying here we should ask ourselves
  // could it only live in the backend? if so let's implement it there. If not, should it also live in the backend or just in the frontend?
  // another note that at the end of the day all of these queries call super.query which is what forwards the request to the backend through /query
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
      dataQueryResponses.push(this.logsQueryRunner.handleLogQueries(logQueries, options, super.query.bind(this)));
    }

    if (metricsQueries.length) {
      dataQueryResponses.push(
        this.metricsQueryRunner.handleMetricQueries(metricsQueries, options, super.query.bind(this))
      );
    }

    if (annotationQueries.length) {
      dataQueryResponses.push(
        this.annotationQueryRunner.handleAnnotationQuery(annotationQueries, options, super.query.bind(this))
      );
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
      ...(isCloudWatchLogsQuery(query) && this.logsQueryRunner.interpolateLogsQueryVariables(query, scopedVars)),
    }));
  }

  /**
   * Get log row context for a given log row. This is called when the user clicks on a log row in the logs visualization and the "show context button"
   * it shows the surrounding logs.
   */
  getLogRowContext(row: LogRowModel, context?: LogRowContextOptions, query?: CloudWatchLogsQuery) {
    return this.logsQueryRunner.getLogRowContext(row, context, super.query.bind(this), query);
  }

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

  getQueryDisplayText(query: CloudWatchQuery) {
    if (isCloudWatchLogsQuery(query)) {
      return query.expression ?? '';
    } else {
      return JSON.stringify(query);
    }
  }

  // public
  getVariables() {
    return this.resources.getVariables();
  }

  getActualRegion(region?: string) {
    if (region === 'default' || region === undefined || region === '') {
      return this.defaultRegion ?? '';
    }
    return region;
  }

  getDefaultQuery(_: CoreApp): Partial<CloudWatchQuery> {
    return {
      ...getDefaultLogsQuery(this.instanceSettings.jsonData.logGroups, this.instanceSettings.jsonData.defaultLogGroups),
      ...DEFAULT_METRICS_QUERY,
    };
  }
}
