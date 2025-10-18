import { AnnotationQuery, CoreApp, DataSourceApi, hasQueryExportSupport, hasQueryImportSupport } from '@grafana/data';
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

  // Step 2: Use datasource's export/import to normalize saved query
  try {
    const newDatasource = await getDataSourceSrv().get(replacedQuery.datasource);

    // Normalize saved query using export/import approach (strips context, keeps content)
    // This follows the same pattern as updateQueries.ts for datasource transitions
    let normalizedQuery = replacedQuery;

    // When datasource supports abstract queries, use export/import to normalize context
    if (hasQueryExportSupport(newDatasource) && hasQueryImportSupport(newDatasource)) {
      const abstractQueries = await newDatasource.exportToAbstractQueries([replacedQuery]);
      const importedQueries = await newDatasource.importFromAbstractQueries(abstractQueries);

      if (importedQueries.length > 0) {
        // Apply annotation-specific defaults to the normalized query
        const annotationDefaults = {
          ...newDatasource.getDefaultQuery?.(CoreApp.Dashboard),
          datasource: replacedQuery.datasource,
          refId: 'Anno',
        };

        normalizedQuery = {
          ...replacedQuery, // Start with all original properties
          ...annotationDefaults, // Apply annotation defaults for context
          ...importedQueries[0], // Apply normalized core query content
          refId: 'Anno', // Always use Anno refId for annotations
        };
      }
    }
    // For datasources without export/import support, keep the query unchanged
    // except for refId which should always be 'Anno' for annotations
    else {
      normalizedQuery = {
        ...replacedQuery,
        refId: 'Anno',
      };
    }

    // Remove datasource property to avoid duplication in target
    const { datasource, ...queryFields } = normalizedQuery;

    // Step 3: Create annotation and apply datasource-specific preparation
    const tempAnnotation: AnnotationQuery = {
      ...cleanAnnotation,
      target: queryFields,
    };

    const processor = { ...standardAnnotationSupport, ...newDatasource.annotations };
    let preparedAnnotation: AnnotationQuery;

    if (processor.prepareAnnotation) {
      // Let the datasource do final preparation/restructuring
      preparedAnnotation = processor.prepareAnnotation(tempAnnotation);
    } else {
      preparedAnnotation = tempAnnotation;
    }

    // Step 4: Handle v1 vs v2 dashboard format after preparation
    if (annotation.query?.spec) {
      // v2 dashboard - sync prepared target to query.spec
      preparedAnnotation.query = {
        ...annotation.query,
        spec: { ...preparedAnnotation.target },
      };
    }

    return preparedAnnotation;
  } catch (error) {
    console.warn('Could not prepare annotation with new datasource:', error);
    // Return structurally correct annotation even if preparation fails
    const { datasource, ...queryFields } = replacedQuery;
    return { ...cleanAnnotation, target: queryFields };
  }
}
