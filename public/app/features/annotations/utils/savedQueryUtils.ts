import { AnnotationQuery, DataQuery, DataSourceApi } from '@grafana/data';

/**
 * Converts an AnnotationQuery to DataQuery format for SavedQueryButtons.
 * Currently only supports v1 dashboards (uses target field).
 */
export function getDataQueryFromAnnotationForSavedQueries(
  annotation: AnnotationQuery,
  datasource: DataSourceApi
): DataQuery {
  const baseQuery = {
    ...datasource.annotations?.getDefaultQuery?.(),
    ...(annotation.target ?? { refId: 'Anno' }),
  };

  return {
    ...baseQuery,
    datasource: annotation.datasource,
  };
}

/**
 * Converts DataQuery back to AnnotationQuery format while preserving annotation metadata.
 * Used when replacing an annotation query with a saved query.
 * Currently only supports v1 dashboards (uses target field).
 */
export function updateAnnotationFromSavedQuery(annotation: AnnotationQuery, replacedQuery: DataQuery): AnnotationQuery {
  return {
    ...annotation, // Keep all annotation-specific fields (enable, iconColor, mappings, etc.)
    datasource: replacedQuery.datasource,
    target: replacedQuery, // v1 format - simple replacement
  };
}
