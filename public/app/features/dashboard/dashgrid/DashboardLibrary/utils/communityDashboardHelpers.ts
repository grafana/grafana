import { PanelModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { DataSourceInput, DashboardJson } from 'app/features/manage-dashboards/types';
import { dispatch } from 'app/types/store';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { MappingContext } from '../SuggestedDashboardsModal';
import { fetchCommunityDashboard, GnetDashboardDependency } from '../api/dashboardLibraryApi';
import { CONTENT_KINDS, ContentKind, CREATION_ORIGINS, EventLocation, SOURCE_ENTRY_POINTS } from '../interactions';
import { GnetDashboard, Link } from '../types';

import { InputMapping, tryAutoMapDatasources, parseConstantInputs, isDataSourceInput } from './autoMapDatasources';

// Constants for community dashboard pagination and API params
// We want to get the most 6 downloaded dashboards, but we first query 12
// to be sure the next filters we apply to that list doesn not reduce it below 6
export const COMMUNITY_PAGE_SIZE_QUERY = 12;
export const COMMUNITY_RESULT_SIZE = 6;

/**
 * Extract thumbnail URL from dashboard screenshots
 */
export function getThumbnailUrl(dashboard: GnetDashboard): string {
  const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
  return thumbnail ? `/api/gnet${thumbnail}` : '';
}

/**
 * Extract logo URL from dashboard logos
 */
export function getLogoUrl(dashboard: GnetDashboard): string {
  const logo = dashboard.logos?.large || dashboard.logos?.small;
  if (logo?.content && logo?.type) {
    return `data:${logo.type};base64,${logo.content}`;
  }
  return '';
}

/**
 * Format date string for display
 */
export function formatDate(dateString?: string): string {
  if (!dateString) {
    return 'N/A';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Build Grafana.com URL for a dashboard
 */
export function buildGrafanaComUrl(dashboard: GnetDashboard): string {
  return `https://grafana.com/grafana/dashboards/${dashboard.id}-${dashboard.slug}/`;
}

/**
 * Build dashboard details object for display in card
 */
export interface DashboardDetails {
  id: string;
  datasource: string;
  dependencies: string[];
  publishedBy: string;
  lastUpdate: string;
  grafanaComUrl: string;
}

export function buildDashboardDetails(dashboard: GnetDashboard): DashboardDetails {
  return {
    id: String(dashboard.id),
    datasource: dashboard.datasource || 'N/A',
    dependencies: dashboard.datasource ? [dashboard.datasource] : [],
    publishedBy: dashboard.orgName || dashboard.userName || 'Grafana Community',
    lastUpdate: formatDate(dashboard.updatedAt || dashboard.publishedAt),
    grafanaComUrl: buildGrafanaComUrl(dashboard),
  };
}

/**
 * Navigate to dashboard template route with mappings
 */
export function navigateToTemplate(
  dashboardTitle: string,
  gnetId: number,
  datasourceUid: string,
  mappings: InputMapping[],
  eventLocation: EventLocation,
  contentKind: ContentKind,
  datasourceTypes?: string[]
): void {
  const searchParams = new URLSearchParams({
    datasource: datasourceUid,
    title: dashboardTitle,
    gnetId: String(gnetId),
    sourceEntryPoint: SOURCE_ENTRY_POINTS.DATASOURCE_PAGE,
    creationOrigin: CREATION_ORIGINS.DASHBOARD_LIBRARY_COMMUNITY_DASHBOARD,
    contentKind,
    eventLocation,
    mappings: JSON.stringify(mappings),
  });

  // Add datasource types for tracking if available
  if (datasourceTypes && datasourceTypes.length > 0) {
    searchParams.set('datasourceTypes', JSON.stringify(datasourceTypes));
  }

  locationService.push({
    pathname: DASHBOARD_LIBRARY_ROUTES.Template,
    search: searchParams.toString(),
  });
}

interface UseCommunityDashboardParams {
  dashboard: GnetDashboard;
  datasourceUid: string;
  datasourceType: string;
  eventLocation: 'empty_dashboard' | 'suggested_dashboards_modal_community_tab';
  onShowMapping?: (context: MappingContext) => void;
}

/**
 * Check if a panel contains JavaScript code using heuristic pattern matching.
 *
 * IMPORTANT: This is a heuristic-based detection, not a perfect mechanism.
 *
 * Patterns checked:
 * - HTML/Script tags: Direct XSS attack vectors
 * - Event handlers: Common JS injection points (onclick, onload, etc.)
 * - Function declarations: Actual executable code patterns
 * - eval/Function constructor: Dynamic code execution
 * - setTimeout/setInterval: Deferred code execution
 *
 * What we DON'T check:
 * - Panel title and description are excluded (already sanitized by Grafana's rendering layer)
 * - Only the panel's options and configuration are scanned
 *
 * @param panel - The panel model to check
 * @returns true if the panel might contain JavaScript code, false otherwise
 */
function canPanelContainJS(panel: PanelModel): boolean {
  // Create a copy of the panel without title and description, as they are already sanitized
  // This reduces false positives while still checking all other properties for JavaScript code
  const { title, description, ...panelWithoutSanitizedFields } = panel;

  let panelJson: string;
  try {
    panelJson = JSON.stringify(panelWithoutSanitizedFields);
  } catch (e) {
    console.warn('Failed to stringify panel', e);
    return true;
  }

  // Patterns that indicate actual JavaScript code in values
  const valuePatterns = [
    /<script\b/i, // HTML script tags
    /\bon\w+\s*=\s*/i, // HTML event handlers: onclick=, onload=, etc.
    /\bjavascript\s*:/i,
    /\bfunction\s*\(/, // Anonymous function declarations: function(
    /\bfunction\s+[\w$]+\s*\(/, // Named function declarations: function name(
    /=>\s*\{[^}]*\breturn\b/, // Arrow function with return statement: () => { return ... }
    /\beval\s*\(/i, // eval() calls
    /\bnew\s+Function\s*\(/i, // new Function() constructor
    /\bsetTimeout\s*\(/i, // setTimeout calls
    /\bsetInterval\s*\(/i, // setInterval calls
  ];

  // Patterns for suspicious JSON keys that might indicate JS hooks
  const keyPatterns = [
    /"on[a-zA-Z]+"\s*:/, // Event handlers as keys (both camelCase and lowercase): "onClick": or "onclick":
    /"beforeRender"\s*:/i, // beforeRender hook as JSON key
    /"afterRender"\s*:/i, // afterRender hook as JSON key
    /"javascript"\s*:/i, // "javascript" as a key
    /"customCode"\s*:/i, // Common pattern for custom code injection
    /"script"\s*:/i, // "script" as a JSON key
    /"handler"\s*:/i, // "handler" as a JSON key - common for event handlers
  ];

  const hasSuspiciousValue = valuePatterns.some((pattern) => {
    if (pattern.test(panelJson)) {
      console.warn('Panel contains JavaScript code in value');
      return true;
    }
    return false;
  });

  const hasSuspiciousKey = keyPatterns.some((pattern) => {
    if (pattern.test(panelJson)) {
      console.warn('Panel contains JavaScript code in key');
      return true;
    }
    return false;
  });

  return hasSuspiciousValue || hasSuspiciousKey;
}

function isPanelModel(panel: unknown): panel is PanelModel {
  if (!panel || typeof panel !== 'object') {
    return false;
  }
  return 'options' in panel && 'type' in panel;
}

/**
 * Check if a dashboard contains JavaScript code. This is not a perfect check, but good enough
 * Used as a second filter after the first filter of panel types (see api/dashboardLibraryApi.ts)
 */
const canDashboardContainJS = (dashboard: DashboardJson): boolean => {
  return dashboard.panels?.some((panel) => {
    // Skip library panels - they don't have options/type and are already validated
    if (isPanelModel(panel)) {
      return canPanelContainJS(panel);
    }
    return false;
  });
};

/**
 * Handles the flow when a user selects a community dashboard:
 * 1. Tracks analytics
 * 2. Fetches full dashboard JSON with __inputs
 * 3. Filters out dashboards that contain JavaScript code due to security reasons
 * 4. Attempts auto-mapping of datasources
 * 5. Either navigates directly or shows mapping form
 */
export async function onUseCommunityDashboard({
  dashboard,
  datasourceUid,
  datasourceType,
  eventLocation,
  onShowMapping,
}: UseCommunityDashboardParams): Promise<void> {
  // Note: item_clicked tracking is done by the caller (CommunityDashboardSection or SuggestedDashboards)
  // with the correct discoveryMethod before calling this function
  try {
    // Fetch full dashboard from Gcom, this is the JSON with __inputs
    const fullDashboard = await fetchCommunityDashboard(dashboard.id);
    const dashboardJson = fullDashboard.json;

    if (canDashboardContainJS(dashboardJson)) {
      throw new Error(`Community dashboard ${dashboard.id} "${dashboard.name}" might contain JavaScript code`);
    }

    // Parse datasource requirements from __inputs
    const dsInputs: DataSourceInput[] = dashboardJson.__inputs?.filter(isDataSourceInput) || [];

    // Extract datasource types for tracking purposes from dependencies
    const datasourceTypes =
      fullDashboard.dependencies?.items
        ?.filter((dep: GnetDashboardDependency) => dep.pluginTypeCode === 'datasource')
        .map((dep: GnetDashboardDependency) => dep.pluginSlug)
        .filter(Boolean) || [];

    // Parse constant inputs - these always need user review
    const constantInputs = parseConstantInputs(dashboardJson.__inputs || []);

    // Try auto-mapping datasources
    const mappingResult = tryAutoMapDatasources(dsInputs, datasourceUid);

    // Decide whether to show mapping form or navigate directly
    // Show mapping form if: (a) there are unmapped datasources OR (b) there are constants
    const needsMapping = mappingResult.unmappedDsInputs.length > 0 || constantInputs.length > 0;

    if (!needsMapping) {
      // No mapping needed - all datasources auto-mapped, no constants
      navigateToTemplate(
        dashboard.name,
        dashboard.id,
        datasourceUid,
        mappingResult.mappings,
        eventLocation,
        CONTENT_KINDS.COMMUNITY_DASHBOARD,
        datasourceTypes
      );
    } else {
      // Show mapping form for unmapped datasources and/or constants
      if (onShowMapping) {
        onShowMapping({
          dashboardName: dashboard.name,
          dashboardJson,
          unmappedDsInputs: mappingResult.unmappedDsInputs,
          constantInputs,
          existingMappings: mappingResult.mappings,
          eventLocation,
          contentKind: CONTENT_KINDS.COMMUNITY_DASHBOARD,
          onInterpolateAndNavigate: (mappings) =>
            navigateToTemplate(
              dashboard.name,
              dashboard.id,
              datasourceUid,
              mappings,
              eventLocation,
              CONTENT_KINDS.COMMUNITY_DASHBOARD,
              datasourceTypes
            ),
        });
      }
    }
  } catch (err) {
    console.error('Error loading community dashboard:', err);
    dispatch(
      notifyApp(
        createErrorNotification(t('dashboard-library.community-error-title', 'Error loading community dashboard'))
      )
    );
    throw err;
  }
}

/**
 * Interpolate a community dashboard for compatibility checking.
 *
 * This function fetches the dashboard from Grafana.com, auto-maps datasource inputs,
 * and returns the interpolated dashboard with template variables resolved.
 *
 * @throws Error if auto-mapping fails - compatibility check requires all datasource inputs to be resolved
 * @param dashboardId - The Grafana.com dashboard ID
 * @param datasourceUid - The UID of the datasource to map to
 * @returns Promise<DashboardJson> - The interpolated dashboard with resolved template variables
 */
export async function interpolateDashboardForCompatibilityCheck(
  dashboardId: number,
  datasourceUid: string
): Promise<DashboardJson> {
  // 1. Fetch full dashboard JSON from Grafana.com
  const gnetResponse = await fetchCommunityDashboard(dashboardId);
  const dashboardJson = gnetResponse.json;

  // 2. Extract datasource inputs from dashboard's __inputs array
  const dsInputs: DataSourceInput[] = dashboardJson.__inputs?.filter(isDataSourceInput) || [];

  // 3. Auto-map datasources using existing utility
  const mappingResult = tryAutoMapDatasources(dsInputs, datasourceUid);

  // 4. Check if auto-mapping was successful
  // Compatibility check requires all datasource variables to be resolved
  if (!mappingResult.allMapped) {
    throw new Error(
      t(
        'dashboard-library.compatibility-auto-map-failed',
        'Unable to automatically map all datasource inputs for this dashboard. Compatibility check requires all datasource variables to be resolved.'
      )
    );
  }

  // 5. Prepare inputs array for interpolation API
  const inputs: InputMapping[] = mappingResult.mappings;

  // 6. Call interpolation endpoint to replace template variables
  const interpolatedDashboard = await getBackendSrv().post<DashboardJson>('/api/dashboards/interpolate', {
    dashboard: dashboardJson,
    overwrite: true,
    inputs: inputs,
  });

  return interpolatedDashboard;
}
