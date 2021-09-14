import { AnnotationQuery, DataQuery } from '@grafana/data';
import { getNextRefIdChar } from 'app/core/utils/query';
import { CloudWatchAnnotationQuery, CloudWatchMetricsQuery } from './types';

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

export function migrateMultipleStatsAnnotationQuery(
  annotationQuery: CloudWatchAnnotationQuery
): Array<AnnotationQuery<DataQuery>> {
  const newAnnotations: CloudWatchAnnotationQuery[] = [];
  if (annotationQuery?.statistics && annotationQuery?.statistics.length) {
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
