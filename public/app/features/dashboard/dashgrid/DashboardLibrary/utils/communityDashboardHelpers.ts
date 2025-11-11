import { locationService } from '@grafana/runtime';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { MappingContext } from '../SuggestedDashboardsModal';
import { fetchCommunityDashboard } from '../api/dashboardLibraryApi';
import { CONTENT_KINDS, ContentKind, CREATION_ORIGINS, EventLocation, SOURCE_ENTRY_POINTS } from '../interactions';
import { GnetDashboard, Link } from '../types';

import { InputMapping, tryAutoMapDatasources, parseConstantInputs, isDataSourceInput } from './autoMapDatasources';

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
 * Create URL-friendly slug from dashboard name
 */
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build Grafana.com URL for a dashboard
 */
export function buildGrafanaComUrl(dashboard: GnetDashboard): string {
  return `https://grafana.com/grafana/dashboards/${dashboard.id}-${createSlug(dashboard.name)}/`;
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
  contentKind: ContentKind
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
 * Handles the flow when a user selects a community dashboard:
 * 1. Tracks analytics
 * 2. Fetches full dashboard JSON with __inputs
 * 3. Attempts auto-mapping of datasources
 * 4. Either navigates directly or shows mapping form
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

    // Parse datasource requirements from __inputs
    const dsInputs: DataSourceInput[] = dashboardJson.__inputs?.filter(isDataSourceInput) || [];

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
        CONTENT_KINDS.COMMUNITY_DASHBOARD
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
              CONTENT_KINDS.COMMUNITY_DASHBOARD
            ),
        });
      }
    }
  } catch (err) {
    console.error('Error loading community dashboard:', err);
    // TODO: Show error notification
  }
}
