import { type ChatContextItem } from '@grafana/assistant';
import { type DashboardJson } from 'app/features/manage-dashboards/types';
import { type PluginDashboard } from 'app/types/plugins';

export interface Link {
  rel: string;
  href: string;
}

interface Screenshot {
  links: Link[];
}

interface LogoImage {
  content: string;
  filename: string;
  type: string;
}

interface Logo {
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

/**
 * A template picked to start a dashboard with the Assistant, instead of opened as a dashboard.
 * The context item carries what the Assistant needs to build from it.
 */
export interface TemplateSelection {
  /** Unique across Grafana-provisioned and custom templates. */
  id: string;
  title: string;
  kind: 'template_dashboard' | 'custom_dashboard_template';
  contextItem: ChatContextItem;
}

/**
 * Turns template cards into a picker: clicking a card hands its template to the caller. A picker renders bare
 * cards, without its own grid or empty state, so the caller can lay out several template sources in one grid.
 */
export interface TemplateSelectionProps {
  onSelectTemplate?: (selection: TemplateSelection) => void;
  /** The picked template's `TemplateSelection.id`, shown as selected. */
  selectedTemplateId?: string;
  /** Reports how many templates the list has once they load, before `searchQuery`, so the host can react to none. */
  onTemplatesLoad?: (count: number) => void;
  /** Shows only the templates whose title or description contains it, ignoring case, as the template modal's search. */
  searchQuery?: string;
  /** Sorts the templates by title. */
  sortOrder?: TemplateSortOrder;
}

export type TemplateSortOrder = 'asc' | 'desc';
