import { getAPINamespace } from '@grafana/api-clients';
import { getBackendSrv } from '@grafana/runtime';
import { DashboardJson } from 'app/features/manage-dashboards/types';

/**
 * Represents a datasource mapping for compatibility checking.
 * Maps dashboard datasource references to actual datasource instances.
 */
export interface DatasourceMapping {
  /** Unique identifier of the datasource */
  uid: string;
  /** Type of datasource (e.g., 'prometheus', 'loki') */
  type: string;
  /** Optional human-readable name for display */
  name?: string;
}

/**
 * Request body for dashboard compatibility check API call
 */
export interface CheckCompatibilityRequest {
  /** Complete dashboard JSON object (supports both v1 and v2 schemas) */
  dashboardJson: DashboardJson;
  /** Array of datasource mappings to check compatibility against */
  datasourceMappings: DatasourceMapping[];
}

/**
 * Breakdown of compatibility metrics for a single query within a panel
 */
export interface QueryBreakdown {
  /** Title of the panel containing this query */
  panelTitle: string;
  /** Numeric ID of the panel */
  panelID: number;
  /** Query reference ID (e.g., 'A', 'B', 'C') */
  queryRefId: string;
  /** Total number of metrics extracted from this query */
  totalMetrics: number;
  /** Number of metrics found in the datasource */
  foundMetrics: number;
  /** List of metric names that were not found */
  missingMetrics: string[];
  /** Compatibility score for this query (0-100) */
  compatibilityScore: number;
  /** Optional error message for queries that failed to parse */
  parseError?: string;
}

/**
 * Compatibility check result for a single datasource
 */
export interface DatasourceResult {
  /** Unique identifier of the datasource */
  uid: string;
  /** Type of datasource */
  type: string;
  /** Optional human-readable name */
  name?: string;
  /** Total number of queries in the dashboard */
  totalQueries: number;
  /** Number of queries that were checked */
  checkedQueries: number;
  /** Total number of unique metrics extracted from all queries */
  totalMetrics: number;
  /** Number of metrics found in the datasource */
  foundMetrics: number;
  /** List of all missing metric names across all queries */
  missingMetrics: string[];
  /** Overall compatibility score for this datasource (0-100) */
  compatibilityScore: number;
  /** Detailed breakdown of compatibility per query */
  queryBreakdown: QueryBreakdown[];
}

/**
 * Overall compatibility check result
 */
export interface CompatibilityCheckResult {
  /** Overall compatibility score across all datasources (0-100) */
  compatibilityScore: number;
  /** Results for each datasource checked */
  datasourceResults: DatasourceResult[];
}

/**
 * Checks dashboard compatibility with specified datasources.
 *
 * This function sends the dashboard JSON and datasource mappings to the backend
 * validation service, which extracts metrics from dashboard queries and checks
 * if those metrics exist in the target datasource(s).
 *
 * Note: The backend currently only supports v1 dashboards (with panels array).
 * V2 dashboards (with elements) will be rejected by the backend with an appropriate error.
 *
 * @param dashboardJson Complete dashboard JSON object (v1 or v2 schema)
 * @param datasourceMappings Array of datasource mappings to validate against
 * @returns Promise resolving to compatibility check results
 * @throws Error if the API call fails or dashboard schema is unsupported
 *
 * @example
 * ```typescript
 * const result = await checkDashboardCompatibility(
 *   { panels: [...], title: "My Dashboard" },
 *   [{ uid: "prometheus-uid", type: "prometheus" }]
 * );
 *
 * console.log(`Compatibility: ${result.compatibilityScore}%`);
 * console.log(`Missing metrics: ${result.datasourceResults[0].missingMetrics}`);
 * ```
 */
export async function checkDashboardCompatibility(
  dashboardJson: DashboardJson,
  datasourceMappings: DatasourceMapping[]
): Promise<CompatibilityCheckResult> {
  // Get namespace from global config (typically 'default' in development)
  // This follows Kubernetes API convention for Grafana app plugins
  const namespace = getAPINamespace();

  // Build request body matching backend schema
  const requestBody: CheckCompatibilityRequest = {
    dashboardJson,
    datasourceMappings,
  };

  try {
    // Make POST request to the dashboard validator app's /check endpoint
    // Following Kubernetes API path convention: /apis/{group}/{version}/namespaces/{namespace}/{resource}
    const response = await getBackendSrv().post<CompatibilityCheckResult>(
      `/apis/dashvalidator.grafana.app/v1alpha1/namespaces/${namespace}/check`,
      requestBody,
      {
        // Disable automatic error alerts - we'll handle errors in the UI
        showErrorAlert: false,
      }
    );

    return response;
  } catch (error) {
    // Log error for debugging
    console.error('Dashboard compatibility check failed:', error);

    // Re-throw original error for caller to handle
    throw error;
  }
}
