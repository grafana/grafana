import { CoreApp, DashboardLoadedEvent, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { variableRegex } from 'app/features/variables/utils';

import { REF_ID_STARTER_LOG_VOLUME } from './datasource';
import pluginJson from './plugin.json';
import { ElasticsearchAnnotationQuery, ElasticsearchQuery } from './types';

type ElasticSearchOnDashboardLoadedTrackingEvent = {
  grafana_version?: string;
  dashboard_id?: string;
  org_id?: number;

  /* The number of Elasticsearch queries present in the dashboard*/
  queries_count: number;

  /* The number of Elasticsearch logs queries present in the dashboard*/
  logs_queries_count: number;

  /* The number of Elasticsearch metric queries present in the dashboard*/
  metric_queries_count: number;

  /* The number of Elasticsearch raw data queries present in the dashboard*/
  raw_data_queries_count: number;

  /* The number of Elasticsearch raw documents queries present in the dashboard*/
  raw_document_queries_count: number;

  /* The number of Elasticsearch queries with used template variables present in the dashboard*/
  queries_with_template_variables_count: number;

  /* The number of Elasticsearch queries with changed line limit present in the dashboard*/
  queries_with_changed_line_limit_count: number;

  /* The number of Elasticsearch queries with lucene query present in the dashboard*/
  queries_with_lucene_query_count: number;
};

export const onDashboardLoadedHandler = ({
  payload: { dashboardId, orgId, grafanaVersion, queries },
}: DashboardLoadedEvent<ElasticsearchQuery>) => {
  try {
    // We only want to track visible ElasticSearch queries
    const elasticsearchQueries = queries[pluginJson.id].filter((query) => !query.hide);
    if (!elasticsearchQueries?.length) {
      return;
    }

    const queriesWithTemplateVariables = elasticsearchQueries.filter(isQueryWithTemplateVariables);
    const queriesWithLuceneQuery = elasticsearchQueries.filter((query) => !!query.query);
    const logsQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'logs');
    const metricQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'metric');
    const rawDataQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'raw_data');
    const rawDocumentQueries = elasticsearchQueries.filter((query) => getQueryType(query) === 'raw_document');
    const queriesWithChangedLineLimit = elasticsearchQueries.filter(isQueryWithChangedLineLimit);

    const event: ElasticSearchOnDashboardLoadedTrackingEvent = {
      grafana_version: grafanaVersion,
      dashboard_id: dashboardId,
      org_id: orgId,
      queries_count: elasticsearchQueries.length,
      logs_queries_count: logsQueries.length,
      metric_queries_count: metricQueries.length,
      raw_data_queries_count: rawDataQueries.length,
      raw_document_queries_count: rawDocumentQueries.length,
      queries_with_template_variables_count: queriesWithTemplateVariables.length,
      queries_with_changed_line_limit_count: queriesWithChangedLineLimit.length,
      queries_with_lucene_query_count: queriesWithLuceneQuery.length,
    };

    reportInteraction('grafana_elasticsearch_dashboard_loaded', event);
  } catch (error) {
    console.error('error in elasticsearch tracking handler', error);
  }
};

const getQueryType = (query: ElasticsearchQuery): string | undefined => {
  if (!query.metrics || !query.metrics.length) {
    return undefined;
  }
  const nonMetricQueryTypes = ['logs', 'raw_data', 'raw_document'];
  if (nonMetricQueryTypes.includes(query.metrics[0].type)) {
    return query.metrics[0].type;
  }
  return 'metric';
};

const getLineLimit = (query: ElasticsearchQuery): number | undefined => {
  if (query.metrics?.[0]?.type !== 'logs') {
    return undefined;
  }

  const lineLimit = query.metrics?.[0].settings?.limit;
  return lineLimit ? parseInt(lineLimit, 10) : undefined;
};

const isQueryWithChangedLineLimit = (query: ElasticsearchQuery): boolean => {
  const lineLimit = getLineLimit(query);
  return lineLimit !== undefined && lineLimit !== 500;
};

const isQueryWithTemplateVariables = (query: ElasticsearchQuery): boolean => {
  return variableRegex.test(query.query ?? '');
};

const shouldNotReportBasedOnRefId = (refId: string): boolean => {
  if (refId.startsWith(REF_ID_STARTER_LOG_VOLUME)) {
    return true;
  }
  return false;
};

export function trackQuery(
  response: DataQueryResponse,
  request: DataQueryRequest<ElasticsearchQuery> & { targets: ElasticsearchQuery[] },
  startTime: Date
): void {
  const { targets: queries, app } = request;
  if (app === CoreApp.Dashboard || app === CoreApp.PanelViewer) {
    return;
  }

  for (const query of queries) {
    if (shouldNotReportBasedOnRefId(query.refId)) {
      return;
    }
    reportInteraction('grafana_elasticsearch_query_executed', {
      app,
      grafana_version: config.buildInfo.version,
      with_lucene_query: query.query ? true : false,
      query_type: getQueryType(query),
      line_limit: getLineLimit(query),
      alias: query.alias,
      has_error: response.error !== undefined,
      has_data: response.data.some((frame) => frame.length > 0),
      simultaneously_sent_query_count: queries.length,
      time_range_from: request?.range?.from?.toISOString(),
      time_range_to: request?.range?.to?.toISOString(),
      time_taken: Date.now() - startTime.getTime(),
    });
  }
}

export function trackAnnotationQuery(annotation: ElasticsearchAnnotationQuery): void {
  reportInteraction('grafana_elasticsearch_annotation_query_executed', {
    grafana_version: config.buildInfo.version,
    has_target_query: !!annotation.target?.query,
    has_query: !!annotation.query,
    has_time_field: !!annotation.timeField,
    has_time_end_field: !!annotation.timeEndField,
    has_tags_field: !!annotation.tagsField,
    has_text_field: !!annotation.textField,
    has_index: !!annotation.index,
  });
}
