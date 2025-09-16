import { AnnotationQuery, DataSourceApi } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { standardAnnotationSupport } from '../standardAnnotationSupport';

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
 *
 * This function is async and self-contained - it returns a properly prepared annotation
 * without relying on external cleanup via verifyDataSource.
 */
export async function updateAnnotationFromSavedQuery(
  annotation: AnnotationQuery,
  replacedQuery: DataQuery
): Promise<AnnotationQuery> {
  // Step 1: Create clean annotation structure with only annotation-specific fields
  const cleanAnnotation = {
    name: annotation.name,
    enable: annotation.enable,
    hide: annotation.hide,
    iconColor: annotation.iconColor,
    mappings: annotation.mappings,
    filter: annotation.filter,
    type: annotation.type,
    builtIn: annotation.builtIn,
    datasource: replacedQuery.datasource,
  };

  // Step 2: Extract query-specific fields (remove datasource from target to avoid duplication)
  const { datasource, ...queryFields } = replacedQuery;

  const tempAnnotation: AnnotationQuery = {
    ...cleanAnnotation,
  };

  // Step 3: Handle v1 vs v2 dashboard format (either/or, not both)
  if (annotation.query?.spec) {
    // v2 dashboard - only update query.spec, no target field
    tempAnnotation.query = {
      ...annotation.query,
      spec: { ...queryFields },
    };
  } else {
    // v1 dashboard - only update target field
    tempAnnotation.target = queryFields;
  }

  // Step 4: Apply datasource-specific preparation immediately
  try {
    const newDatasource = await getDataSourceSrv().get(replacedQuery.datasource);
    const processor = { ...standardAnnotationSupport, ...newDatasource.annotations };

    if (processor.prepareAnnotation) {
      return processor.prepareAnnotation(tempAnnotation);
    }

    return tempAnnotation;
  } catch (error) {
    console.warn('Could not prepare annotation with new datasource:', error);
    // Return structurally correct annotation even if preparation fails
    return tempAnnotation;
  }
}
