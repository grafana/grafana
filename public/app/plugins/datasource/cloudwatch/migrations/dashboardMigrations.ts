// Functions in this file are called from the app/features/dashboard/state/DashboardMigrator.
// Migrations applied by the DashboardMigrator are performed before the plugin is loaded.
// DashboardMigrator migrations are tied to a certain minimum version of a dashboard which means they will only be ran once.

import { AnnotationQuery, getNextRefId } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { CloudWatchMetricsQuery, LegacyAnnotationQuery, MetricQueryType, MetricEditorMode } from '../types';

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
    newTarget.refId = getNextRefId(panelQueries);
    delete newTarget.statistics;
    panelQueries.push(newTarget);
  }
  delete query.statistics;

  return newQueries;
}

// Migrates an annotation query that use more than one statistic into multiple queries
// E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
export function migrateMultipleStatsAnnotationQuery(
  annotationQuery: AnnotationQuery<LegacyAnnotationQuery>
): Array<AnnotationQuery<DataQuery>> {
  const newAnnotations: Array<AnnotationQuery<LegacyAnnotationQuery>> = [];

  if (annotationQuery && 'statistics' in annotationQuery) {
    if (annotationQuery?.statistics?.length) {
      for (const stat of annotationQuery.statistics.splice(1)) {
        const { statistics, name, ...newAnnotation } = annotationQuery;
        newAnnotations.push({ ...newAnnotation, statistic: stat, name: `${name} - ${stat}` });
      }
      annotationQuery.statistic = annotationQuery.statistics[0];
      // Only change the name of the original if new annotations have been created
      if (newAnnotations.length !== 0) {
        annotationQuery.name = `${annotationQuery.name} - ${annotationQuery.statistic}`;
      }
    }
    delete annotationQuery.statistics;
  }

  return newAnnotations;
}

export function migrateCloudWatchQuery(query: CloudWatchMetricsQuery) {
  if (!query.hasOwnProperty('metricQueryType')) {
    query.metricQueryType = MetricQueryType.Search;
  }

  if (!query.hasOwnProperty('metricEditorMode')) {
    if (query.metricQueryType === MetricQueryType.Insights) {
      query.metricEditorMode = MetricEditorMode.Code;
    } else {
      query.metricEditorMode = query.expression ? MetricEditorMode.Code : MetricEditorMode.Builder;
    }
  }
}
