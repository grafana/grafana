/**
 * Types for Grafana.com (Gnet) Dashboard API integration
 * Used for community dashboard discovery and import in the Dashboard Library
 */

export interface GnetDashboardScreenshot {
  id: number;
  name: string;
  filename: string;
  mainScreenshot: boolean;
  links: Array<{
    rel: string;
    href: string;
  }>;
}

export interface GnetDashboardLogo {
  small: {
    type: string;
    filename: string;
    content: string; // Base64 encoded image
  };
}

/**
 * Dashboard from Grafana.com catalog API
 * Used when listing/browsing community dashboards
 */
export interface GnetDashboard {
  id: number; // Gnet dashboard ID
  name: string; // Dashboard title
  description: string;
  datasource: string; // Primary datasource type
  datasourceSlugs: string[]; // All datasource types used
  downloads: number;
  screenshots?: GnetDashboardScreenshot[];
  logos?: GnetDashboardLogo;
  slug: string;
  orgName: string;
}

/**
 * Detailed dashboard response from /api/gnet/dashboards/{id}
 * Includes the dashboard JSON for import
 */
export interface GnetDashboardDetails extends GnetDashboard {
  json: string; // Stringified dashboard JSON
  updatedAt: string;
}

/**
 * Response from /api/gnet/dashboards listing endpoint
 */
export interface GnetDashboardListResponse {
  items: GnetDashboard[];
  page: number;
  pageSize: number;
  pages: number;
  total: number;
}
