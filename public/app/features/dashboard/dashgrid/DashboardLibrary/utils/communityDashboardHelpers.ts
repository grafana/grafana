import { locationService } from '@grafana/runtime';

import { DASHBOARD_LIBRARY_ROUTES } from '../../types';
import { GnetDashboard, Link } from '../types';

import { InputMapping } from './autoMapDatasources';

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
  eventLocation: string,
  contentKind: string
): void {
  const searchParams = new URLSearchParams({
    datasource: datasourceUid,
    title: dashboardTitle,
    gnetId: String(gnetId),
    sourceEntryPoint: 'datasource_page',
    creationOrigin: 'dashboard_library_community_dashboard',
    contentKind,
    eventLocation,
    mappings: JSON.stringify(mappings),
  });

  locationService.push({
    pathname: DASHBOARD_LIBRARY_ROUTES.Template,
    search: searchParams.toString(),
  });
}
