import { hasQueryExportSupport, hasQueryImportSupport } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { AlertQuery } from 'app/types/unified-alerting-dto';

// Supported datasources for saved queries in alerting context
const SUPPORTED_ALERTING_DATASOURCES = ['prometheus', 'loki'];

/**
 * Checks if a datasource is supported for saved queries in alerting.
 * Currently supports: Prometheus, Loki
 */
export function isAlertingSavedQuerySupported(datasourceType: string): boolean {
  return SUPPORTED_ALERTING_DATASOURCES.includes(datasourceType.toLowerCase());
}

/**
 * Applies datasource-specific context properties for alerting.
 * This handles the context mismatch between Explore (range queries) and Alerting (instant queries).
 */
function applyAlertingContextProperties(query: DataQuery, datasourceType: string): DataQuery {
  const lowerType = datasourceType.toLowerCase();

  if (lowerType === 'prometheus') {
    // Prometheus: Use instant queries (single value at a point in time) for alerting
    // Note: instant and range are Prometheus-specific properties, not on base DataQuery
    return {
      ...query,
      //@ts-ignore TODO: is there a way to type this properly?
      instant: true,
      range: false,
    };
  }

  if (lowerType === 'loki') {
    // Loki: Use instant query type for alerting
    // Note: queryType is Loki-specific property, not on base DataQuery
    return {
      ...query,
      queryType: 'instant',
    };
  }

  return query;
}

/**
 * Converts DataQuery to AlertQuery format while applying context-aware normalization.
 * Used when replacing an alert query with a saved query.
 *
 * Currently supports: Prometheus and Loki datasources only.
 * For other datasources, saved queries will be filtered out in the UI.
 *
 * @param alertQuery - The target AlertQuery to replace
 * @param replacedQuery - The saved query (DataQuery) to apply
 * @returns Promise<AlertQuery> - Properly normalized AlertQuery for alerting context
 */
export async function updateAlertQueryFromSavedQuery(
  alertQuery: AlertQuery,
  replacedQuery: DataQuery
): Promise<AlertQuery> {
  try {
    const replacedDatasource = await getDataSourceSrv().get(replacedQuery.datasource);
    const originalAlertDatasource = await getDataSourceSrv().get(alertQuery.datasourceUid);
    let normalizedQuery = replacedQuery;

    // Check if datasource is supported
    if (!isAlertingSavedQuerySupported(replacedDatasource.type)) {
      throw new Error(`Saved queries are not supported for ${replacedDatasource.type} in alerting context`);
    }

    // Use export/import to get normalized query content (expr, etc.)
    // If the datasource is the same, we might be dealing with cross-context scenearios (query from Prometheus to Loki
    // in explore being used in annotations, then we need to normalized the query)
    // /FIXME: This is a bit hacky, because we're using export/import to get normalized query content we lost
    // expressions, functions from the replaced query
    if (
      hasQueryExportSupport(replacedDatasource) &&
      hasQueryImportSupport(replacedDatasource) &&
      replacedDatasource.type !== originalAlertDatasource.type
    ) {
      const abstractQueries = await replacedDatasource.exportToAbstractQueries([replacedQuery]);
      const importedQueries = await replacedDatasource.importFromAbstractQueries(abstractQueries);

      if (importedQueries.length > 0) {
        // Strategy: Preserve all properties from saved query, then apply alerting context
        // 1. Start with saved query (has legendFormat, interval, etc.)
        // 2. Override with imported expr (normalized, without context properties)
        // 3. Apply datasource-specific alerting context properties (instant, range, queryType)
        normalizedQuery = {
          ...replacedQuery, // All saved query properties (legendFormat, interval, etc.)
          ...importedQueries[0], // Normalized expr from export/import
          datasource: replacedQuery.datasource,
          refId: alertQuery.refId,
        };

        // Apply datasource-specific context properties for alerting
        normalizedQuery = applyAlertingContextProperties(normalizedQuery, replacedDatasource.type);

        console.warn(
          'Cross datasource replacement, normalized query from saved query for alerting context, we might have lost expressions, aggregators, etc:',
          JSON.stringify(normalizedQuery, null, 2)
        );
      }
    } else {
      // FALLBACK PATH: Direct copy with context override
      normalizedQuery = {
        ...replacedQuery,
        refId: alertQuery.refId,
      };

      // Apply datasource-specific context properties
      normalizedQuery = applyAlertingContextProperties(normalizedQuery, replacedDatasource.type);
    }

    // Step 2: Create updated AlertQuery with proper datasource synchronization
    return {
      ...alertQuery,
      model: normalizedQuery,
      datasourceUid: normalizedQuery.datasource?.uid || alertQuery.datasourceUid,
      queryType: 'query', // 'query' indicates a regular datasource query (not an expression)
    };
  } catch (error) {
    console.warn('Could not normalize query for alerting context:', error);

    // Fallback: Return basic AlertQuery structure even if normalization fails
    return {
      ...alertQuery,
      model: {
        ...replacedQuery,
        refId: alertQuery.refId,
      },
      datasourceUid: replacedQuery.datasource?.uid || alertQuery.datasourceUid,
    };
  }
}

/**
 * Validates whether a saved query is compatible with alerting context.
 *
 * @param savedQuery - The saved query to validate
 * @returns Validation result with compatibility status and issues
 */
export function validateSavedQueryForAlerting(savedQuery: DataQuery): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for missing datasource reference
  if (!savedQuery.datasource?.uid) {
    issues.push('Missing datasource reference');
  }

  // Check for problematic template variables (not implemented in this phase)
  // This would use the hasUnresolvedVariables utility from templateVariables.ts
  // if (hasUnresolvedVariables(savedQuery)) {
  //   issues.push('Contains dashboard variables not supported in alerting');
  // }

  // Check for expression queries (special handling needed)
  if (savedQuery.datasource?.uid === '__expr__') {
    warnings.push('Expression queries may need special handling in alerting context');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Helper function to determine if datasource change requires skip logic.
 * Based on analysis of dual processing scenarios in alerting.
 *
 * @param currentDatasourceUid - Current AlertQuery datasource UID
 * @param replacementDatasourceUid - Replacement query datasource UID
 * @returns boolean - Whether skip logic should be applied
 */
export function shouldUseSkipLogicForQueryReplacement(
  currentDatasourceUid: string,
  replacementDatasourceUid: string | undefined
): boolean {
  // Skip logic is needed for cross-datasource scenarios to prevent race conditions
  // Same-datasource replacements don't trigger onChangeDataSource, so no skip needed
  return Boolean(replacementDatasourceUid && replacementDatasourceUid !== currentDatasourceUid);
}
