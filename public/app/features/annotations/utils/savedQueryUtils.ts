import { AnnotationQuery, DataSourceApi } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

/**
 * Converts an AnnotationQuery to DataQuery format for SavedQueryButtons.
 * Supports both v1 dashboards (uses target field) and v2 dashboards (uses query.spec field).
 */
export function getDataQueryFromAnnotationForSavedQueries(
  annotation: AnnotationQuery,
  datasource: DataSourceApi
): DataQuery {
  // For v2 dashboards, use query.spec
  let querySpec = annotation.target;
  if (annotation.query && annotation.query.spec) {
    querySpec = annotation.query.spec;
  }

  const baseQuery = {
    ...datasource.annotations?.getDefaultQuery?.(),
    ...(querySpec ?? { refId: 'Anno' }),
  };

  return {
    ...baseQuery,
    datasource: annotation.datasource,
  };
}

/**
 * Converts DataQuery back to AnnotationQuery format while preserving annotation metadata.
 * Used when replacing an annotation query with a saved query.
 * Supports both v1 dashboards (uses target field) and v2 dashboards (uses query.spec field).
 */
export function updateAnnotationFromSavedQuery(annotation: AnnotationQuery, replacedQuery: DataQuery): AnnotationQuery {
  // Step 1: Create annotation with replaced query data
  // Clean annotation - only keep annotation-specific fields, not old query data
  const cleanAnnotation = {
    name: annotation.name,
    enable: annotation.enable,
    hide: annotation.hide,
    iconColor: annotation.iconColor,
    mappings: annotation.mappings,
    filter: annotation.filter,
    type: annotation.type,
    builtIn: annotation.builtIn,
  };

  const tempAnnotation: AnnotationQuery = {
    ...cleanAnnotation, // Keep ONLY annotation-specific fields
    datasource: replacedQuery.datasource,
    target: replacedQuery, // v1 format - clean query
  };

  // For v2 dashboards, also update query.spec
  if (annotation.query && annotation.query.spec) {
    tempAnnotation.query = {
      ...annotation.query,
      spec: { ...replacedQuery },
    };
  }

  return tempAnnotation;
}
