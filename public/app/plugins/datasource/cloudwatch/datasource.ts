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
  Dimensions,
} from './types';
import { CloudWatchVariableSupport } from './variables';

export class CloudWatchDatasource
  extends DataSourceWithBackend<CloudWatchQuery, CloudWatchJsonData>
  implements DataSourceWithLogsContextSupport<CloudWatchLogsQuery>
{
  defaultRegion: any;
  languageProvider: CloudWatchLanguageProvider;
  sqlCompletionItemProvider: SQLCompletionItemProvider;
  metricMathCompletionItemProvider: MetricMathCompletionItemProvider;

  type = 'cloudwatch';
  standardStatistics = ['Average', 'Maximum', 'Minimum', 'Sum', 'SampleCount'];

  private metricsQueryRunner: CloudWatchMetricsQueryRunner;
  private annotationQueryRunner: CloudWatchAnnotationQueryRunner;
  // this member should be private too, but we need to fix https://github.com/grafana/grafana/issues/55243 to enable that
  logsQueryRunner: CloudWatchLogsQueryRunner;

  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.defaultRegion = instanceSettings.jsonData.defaultRegion;
    this.languageProvider = new CloudWatchLanguageProvider(this);
    this.sqlCompletionItemProvider = new SQLCompletionItemProvider(this, this.templateSrv);
    this.metricMathCompletionItemProvider = new MetricMathCompletionItemProvider(this, this.templateSrv);
    this.variables = new CloudWatchVariableSupport(this);
    this.annotations = CloudWatchAnnotationSupport;
    this.metricsQueryRunner = new CloudWatchMetricsQueryRunner(instanceSettings, templateSrv);
    this.logsQueryRunner = new CloudWatchLogsQueryRunner(instanceSettings, templateSrv, timeSrv);
    this.annotationQueryRunner = new CloudWatchAnnotationQueryRunner(instanceSettings, templateSrv);
  }

  // datasource api

  filterQuery(query: CloudWatchQuery) {
    return query.hide !== true || (isCloudWatchMetricsQuery(query) && query.id !== '');
  }

  query(options: DataQueryRequest<CloudWatchQuery>): Observable<DataQueryResponse> {
    options = cloneDeep(options);

    let queries = options.targets.filter(this.filterQuery);
    const { logQueries, metricsQueries, annotationQueries } = getTargetsByQueryMode(queries);

    const dataQueryResponses: Array<Observable<DataQueryResponse>> = [];
    if (logQueries.length > 0) {
      dataQueryResponses.push(this.logsQueryRunner.handleLogQueries(logQueries, options));
    }

    if (metricsQueries.length > 0) {
      dataQueryResponses.push(this.metricsQueryRunner.handleMetricQueries(metricsQueries, options));
    }

    if (annotationQueries.length > 0) {
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
      region: this.getActualRegion(
        this.metricsQueryRunner.replaceVariableAndDisplayWarningIfMulti(query.region, scopedVars)
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
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
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

  doMetricResourceRequest(subtype: string, parameters?: any): Promise<Array<{ text: any; label: any; value: any }>> {
    return this.getResource(subtype, parameters);
  }

  // resource requests
  getRegions(): Promise<Array<{ label: string; value: string; text: string }>> {
    return this.doMetricResourceRequest('regions').then((regions: any) => [
      { label: 'default', value: 'default', text: 'default' },
      ...regions,
    ]);
  }

  getNamespaces() {
    return this.doMetricResourceRequest('namespaces');
  }

  async getMetrics(namespace: string | undefined, region?: string) {
    if (!namespace) {
      return [];
    }

    return this.doMetricResourceRequest('metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
    });
  }

  async getAllMetrics(region: string): Promise<Array<{ metricName: string; namespace: string }>> {
    const values = await this.doMetricResourceRequest('all-metrics', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
    });

    return values.map((v) => ({ metricName: v.value, namespace: v.text }));
  }

  async getDimensionKeys(
    namespace: string | undefined,
    region: string,
    dimensionFilters: Dimensions = {},
    metricName = ''
  ) {
    if (!namespace) {
      return [];
    }

    return this.doMetricResourceRequest('dimension-keys', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      dimensionFilters: JSON.stringify(this.metricsQueryRunner.convertDimensionFormat(dimensionFilters, {})),
      metricName,
    });
  }

  async getDimensionValues(
    region: string,
    namespace: string | undefined,
    metricName: string | undefined,
    dimensionKey: string,
    filterDimensions: {}
  ) {
    if (!namespace || !metricName) {
      return [];
    }

    const values = await this.doMetricResourceRequest('dimension-values', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      namespace: this.templateSrv.replace(namespace),
      metricName: this.templateSrv.replace(metricName.trim()),
      dimensionKey: this.templateSrv.replace(dimensionKey),
      dimensions: JSON.stringify(this.metricsQueryRunner.convertDimensionFormat(filterDimensions, {})),
    });

    return values;
  }

  getEbsVolumeIds(region: string, instanceId: string) {
    return this.doMetricResourceRequest('ebs-volume-ids', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      instanceId: this.templateSrv.replace(instanceId),
    });
  }

  getEc2InstanceAttribute(region: string, attributeName: string, filters: any) {
    return this.doMetricResourceRequest('ec2-instance-attribute', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      attributeName: this.templateSrv.replace(attributeName),
      filters: JSON.stringify(this.metricsQueryRunner.convertMultiFilterFormat(filters, 'filter key')),
    });
  }

  getResourceARNs(region: string, resourceType: string, tags: any) {
    return this.doMetricResourceRequest('resource-arns', {
      region: this.templateSrv.replace(this.getActualRegion(region)),
      resourceType: this.templateSrv.replace(resourceType),
      tags: JSON.stringify(this.metricsQueryRunner.convertMultiFilterFormat(tags, 'tag name')),
    });
  }
}

function getTargetsByQueryMode(targets: CloudWatchQuery[]) {
  const logQueries: CloudWatchLogsQuery[] = [];
  const metricsQueries: CloudWatchMetricsQuery[] = [];
  const annotationQueries: CloudWatchAnnotationQuery[] = [];

  targets.forEach((query) => {
    if (isCloudWatchAnnotationQuery(query)) {
      annotationQueries.push(query);
    } else if (isCloudWatchLogsQuery(query)) {
      logQueries.push(query);
    } else {
      metricsQueries.push(query);
    }
  });

  return {
    logQueries,
    metricsQueries,
    annotationQueries,
  };
}
