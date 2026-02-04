import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard } from '../types';

/**
 * Type guard to distinguish GnetDashboard (grafana.com templates) from PluginDashboard.
 * GnetDashboard has additional fields like downloads, datasource, and panelTypeSlugs.
 */
export function isGnetDashboard(d: PluginDashboard | GnetDashboard): d is GnetDashboard {
  return 'datasource' in d && 'downloads' in d;
}

/**
 * Template context data structure for the Grafana Assistant.
 * Contains metadata about the dashboard template being used.
 */
export interface TemplateContextData {
  templateName: string;
  description?: string;
  datasource?: string;
  panelTypes?: string[];
  author?: string;
}

/**
 * Builds the data object for creating an assistant context item.
 * Only includes datasource for suggested dashboards (template dashboards use generic "test data source").
 */
export function buildTemplateContextData(
  dashboard: PluginDashboard | GnetDashboard,
  title: string,
  kind: 'template_dashboard' | 'suggested_dashboard'
): TemplateContextData {
  const isGnet = isGnetDashboard(dashboard);

  return {
    templateName: isGnet ? dashboard.name : title,
    description: dashboard.description || undefined,
    // Only include datasource for suggested dashboards where it's meaningful
    // template dashboards use generic "test data source" so we omit it
    datasource: kind === 'suggested_dashboard' && isGnet ? dashboard.datasource : undefined,
    panelTypes: isGnet ? dashboard.panelTypeSlugs : undefined,
    author: isGnet ? dashboard.orgName || dashboard.userName : undefined,
  };
}

/**
 * Builds the title for the assistant context item.
 */
export function buildTemplateContextTitle(dashboard: PluginDashboard | GnetDashboard, title: string): string {
  const isGnet = isGnetDashboard(dashboard);
  return `Dashboard Template: ${isGnet ? dashboard.name : title}`;
}

/**
 * Builds a descriptive prompt for the Grafana Assistant when using a dashboard template.
 * For template dashboards: asks LLM to analyze and suggest appropriate datasources.
 * For suggested dashboards: includes the specific datasource info.
 */
export function buildAssistantPrompt(
  dashboard: PluginDashboard | GnetDashboard,
  title: string,
  kind: 'template_dashboard' | 'suggested_dashboard'
): string {
  const lines: string[] = [`Create a new dashboard based on the "${title}" template.`, '', 'Template details:'];

  if (isGnetDashboard(dashboard)) {
    // For suggested dashboards, include the specific datasource
    // For template dashboards, datasource is generic ("test data source") so we omit it
    if (kind === 'suggested_dashboard' && dashboard.datasource) {
      lines.push(`- Data source: ${dashboard.datasource}`);
    }
    if (dashboard.description) {
      lines.push(`- Description: ${dashboard.description}`);
    }
    if (dashboard.panelTypeSlugs?.length) {
      lines.push(`- Panel types: ${dashboard.panelTypeSlugs.join(', ')}`);
    }
    if (dashboard.orgName || dashboard.userName) {
      lines.push(`- Published by: ${dashboard.orgName || dashboard.userName}`);
    }
  } else if (dashboard.description) {
    lines.push(`- Description: ${dashboard.description}`);
  }

  lines.push('');

  if (kind === 'template_dashboard') {
    // For templates, guide the LLM to analyze and suggest datasources
    lines.push(
      'Based on this template description, please analyze what type of data it expects, ' +
        'check my available data sources, and suggest which ones would be appropriate for this dashboard.'
    );
    lines.push('');
    lines.push(
      'IMPORTANT: Before creating any panels, first query the selected datasource to discover ' +
        'what metrics are actually available, then map them to the template requirements. ' +
        'Do not assume standard metric names exist.'
    );
  } else {
    lines.push('Please adapt this template to my environment and available data sources.');
  }

  return lines.join('\n');
}
