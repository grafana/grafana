import { AnnotationQuery, DataQuery } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { MetricEditorMode, CloudWatchAnnotationQuery, CloudWatchMetricsQuery, MetricQueryType } from './types';

// Migrates a metric query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsMetricsQuery(
  query: CloudWatchMetricsQuery,
  panelQueries: DataQuery[]
): DataQuery[] {
  const newQueries = [];
  if (query?.statistics && query?.statistics.length) {
    query.statistic = query.statistics[0];
    for (const stat of query.statistics.splice(1)) {
      newQueries.push({ ...query, statistic: stat });
    }
  }
  for (const newTarget of newQueries) {
    newTarget.refId = getNextRefIdChar(panelQueries);
    delete newTarget.statistics;
    panelQueries.push(newTarget);
  }
  delete query.statistics;

  return newQueries;
}

// Migrates an annotation query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsAnnotationQuery(
  annotationQuery: CloudWatchAnnotationQuery
): Array<AnnotationQuery<DataQuery>> {
  const newAnnotations: CloudWatchAnnotationQuery[] = [];

  if (annotationQuery && 'statistics' in annotationQuery && annotationQuery?.statistics?.length) {
    for (const stat of annotationQuery.statistics.splice(1)) {
      const { statistics, name, ...newAnnotation } = annotationQuery;
      newAnnotations.push({ ...newAnnotation, statistic: stat, name: `${name} - ${stat}` });
    }
    annotationQuery.statistic = annotationQuery.statistics[0];
    // Only change the name of the original if new annotations have been created
    if (newAnnotations.length !== 0) {
      annotationQuery.name = `${annotationQuery.name} - ${annotationQuery.statistic}`;
    }
    delete annotationQuery.statistics;
  }

  return newAnnotations as Array<AnnotationQuery<DataQuery>>;
}

export function migrateCloudWatchQuery(query: CloudWatchMetricsQuery) {
  if (!query.hasOwnProperty('metricQueryType')) {
    query.metricQueryType = MetricQueryType.Search;
  }

  if (!query.hasOwnProperty('metricEditorMode')) {
    if (query.metricQueryType === MetricQueryType.Query) {
      query.metricEditorMode = MetricEditorMode.Code;
    } else {
      query.metricEditorMode = query.expression ? MetricEditorMode.Code : MetricEditorMode.Builder;
    }
  }
}
