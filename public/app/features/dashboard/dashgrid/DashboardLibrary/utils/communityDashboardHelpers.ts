import { PanelModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { dispatch } from 'app/types/store';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { MappingContext } from '../SuggestedDashboardsModal';
import { fetchCommunityDashboard, GnetDashboardDependency } from '../api/dashboardLibraryApi';
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
 * Check if a panel contains JavaScript code. This is not a perfect check, but good enough
 */
function canPanelContainJS(panel: PanelModel): boolean {
  const candidates: Array<{ keyPath: string; value: string }> = [];

  function collect(obj: Object, path: string[]) {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      const nextPath = [...path, key];
      if (typeof value === 'string') {
        if (value.trim().length >= 4) {
          candidates.push({ keyPath: nextPath.join('.'), value });
        }
      } else if (value && typeof value === 'object') {
        collect(value, nextPath);
      }
    }
  }

  if (panel.options) {
    collect(panel.options, ['options']);
  }

  const valuePatterns = [
    /<script\b/i,
    /\bon\w+="[^"]*"/i,
    /javascript:/i,
    /\bfunction\b/,
    /=>/,
    /\breturn\b/,
    /\bsetTimeout\b/i,
    /\bsetInterval\b/i,
  ];
  const keyPatterns = [
    /\bscript\b/i,
    /\bcode\b/i,
    /\bjavascript\b/i,
    /\bjs\b/i,
    /\bonclick\b/i,
    /\bbeforeRender\b/i,
    /\bafterRender\b/i,
    /\bhandler\b/i,
  ];

  return candidates.some(({ keyPath, value }) => {
    if (valuePatterns.some((re) => re.test(value))) {
      console.warn('Panel contains JavaScript code in value', value);
      return true;
    }
    if (keyPatterns.some((re) => re.test(keyPath))) {
      console.warn('Panel contains JavaScript code', keyPath);
      return true;
    }
    return false;
  });
}

/**
 * Check if a dashboard contains JavaScript code. This is not a perfect check, but good enough
 * Used as a second filter after the first filter of panel types (see api/dashboardLibraryApi.ts)
 */
const canDashboardContainJS = (dashboard: DashboardJson): boolean => {
  return dashboard.panels?.some((panel) => {
    if (panel && typeof panel === 'object' && 'options' in panel) {
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
      throw new Error(`Community dashboard ${dashboard.id} ${dashboard.name} might contain JavaScript code`);
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
