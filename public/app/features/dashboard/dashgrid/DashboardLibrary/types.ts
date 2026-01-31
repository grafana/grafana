import { DashboardJson } from 'app/features/manage-dashboards/types';
import { PluginDashboard } from 'app/types/plugins';

export interface Link {
  rel: string;
  href: string;
}

export interface Screenshot {
  links: Link[];
}

export interface LogoImage {
  content: string;
  filename: string;
  type: string;
}

export interface Logo {
  small?: LogoImage;
  large?: LogoImage;
}

export interface GnetDashboard {
  id: number;
  name: string;
  description: string;
  slug: string;
  downloads: number;
  datasource: string;
  screenshots?: Screenshot[];
  logos?: Logo;
  json?: DashboardJson; // Full dashboard JSON from detail API
  createdAt?: string; // ISO date string if available
  updatedAt?: string; // ISO date string if available
  publishedAt?: string; // ISO date string if available
  // Author/organization information
  orgId?: number;
  orgName?: string;
  orgSlug?: string;
  userId?: number;
  userName?: string;
  panelTypeSlugs?: string[];
}

export interface GnetDashboardsResponse {
  page: number;
  pages: number;
  items: GnetDashboard[];
}

/**
 * Type guard to check if a dashboard is a GnetDashboard (community dashboard).
 * PluginDashboard has fields like importedRevision, importedUri, path that GnetDashboard doesn't have.
 */
export function isGnetDashboard(dashboard: PluginDashboard | GnetDashboard): dashboard is GnetDashboard {
  return !('importedRevision' in dashboard || 'importedUri' in dashboard || 'path' in dashboard);
}
