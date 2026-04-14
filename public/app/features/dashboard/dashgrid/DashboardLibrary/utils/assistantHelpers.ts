import { firstValueFrom, map } from 'rxjs';

import { isAssistantAvailable } from '@grafana/assistant';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { type PluginDashboard } from 'app/types/plugins';

import { type GnetDashboard } from '../types';

import { isGnetDashboard } from './dashboardLibraryHelpers';

/**
 * Template context data structure for the Grafana Assistant.
 * Contains metadata about the dashboard template being used.
 */
export interface TemplateContextData {
  templateName?: string;
  name?: string;
  description?: string;
  datasource?: string;
  panelTypes?: string[];
  author?: string;
  instructions?: string;
}

/**
 * Builds the data object for creating an assistant context item.
 * Only includes datasource for suggested dashboards (template dashboards use generic "test data source").
 * For template dashboards: asks LLM to analyze and suggest appropriate datasources.
 * For suggested dashboards: includes the specific datasource info.
 */
export function buildTemplateContextData(
  dashboard: PluginDashboard | GnetDashboard,
  kind: 'template_dashboard' | 'suggested_dashboard'
): TemplateContextData {
  const isGnet = isGnetDashboard(dashboard);

  const buildInstructions = () => {
    const lines = [];

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

    if (kind === 'template_dashboard') {
      // For templates, guide the LLM to analyze and suggest datasources
      lines.push(
        'Based on this template description, please analyze what type of data it expects, ' +
          'check the available data sources, and suggest which ones would be appropriate for this dashboard. Let the user choose the one they want to use.'
      );
      lines.push('');
      lines.push(
        'IMPORTANT: Before creating any panels, first query the selected datasource to discover ' +
          'what metrics are actually available, then map them to the template requirements. ' +
          'Do not assume standard metric names exist.'
      );
    } else {
      lines.push(
        'The dashboard is already rendered on the current page — it is loaded but not yet saved. ' +
          "Your goal is to adapt its panels and queries to work with the user's available data sources. " +
          'Prefer lightweight tools first — use a dashboard summary to understand the structure before reading individual panels, and avoid reading all panels at once. ' +
          "Do NOT save or create the dashboard — saving is the user's responsibility. " +
          'If you think additional panels would be valuable, ask the user before adding them. ' +
          'If the original datasource is unavailable and you are considering switching to a test datasource, ask the user for explicit permission first.'
      );
    }

    return lines.join('\n');
  };

  return {
    // For suggested dashboards, use `name` instead of `templateName` to avoid the LLM
    // associating this with the template-dashboard tool and treating it as a template to create.
    ...(kind === 'suggested_dashboard'
      ? { name: isGnet ? dashboard.name : dashboard.title }
      : { templateName: isGnet ? dashboard.name : dashboard.title }),
    description: dashboard.description,
    // Only include datasource for suggested dashboards where it's meaningful
    // template dashboards use generic "test data source" so we omit it
    datasource: kind === 'suggested_dashboard' && isGnet ? dashboard.datasource : undefined,
    panelTypes: isGnet ? dashboard.panelTypeSlugs : undefined,
    author: isGnet ? dashboard.orgName || dashboard.userName : undefined,
    instructions:
      kind === 'suggested_dashboard'
        ? `Use the following dashboard details to adapt this dashboard: ${buildInstructions()}`
        : `Use the following template details to create the dashboard: ${buildInstructions()}`,
  };
}

/**
 * Builds the title for the assistant context item.
 */
export function buildTemplateContextTitle(
  dashboard: PluginDashboard | GnetDashboard,
  kind: 'template_dashboard' | 'suggested_dashboard'
): string {
  const isGnet = isGnetDashboard(dashboard);
  const name = isGnet ? dashboard.name : dashboard.title;
  return kind === 'suggested_dashboard' ? `Dashboard: ${name}` : `Dashboard Template: ${name}`;
}

/**
 * Builds the prompt for the Grafana Assistant when using a dashboard template.
 * For suggested dashboards (already rendered), asks to adapt the existing dashboard.
 * For template dashboards, asks to create a new dashboard from the template.
 */
export function buildAssistantPrompt(kind: 'template_dashboard' | 'suggested_dashboard'): string {
  if (kind === 'suggested_dashboard') {
    return `Adapt this dashboard to my environment by connecting it to my available data sources and adjusting queries as needed.`;
  }
  return `Create a new dashboard based on this dashboard template.`;
}

/**
 * Async function to check if the suggested dashboard assistant is enabled.
 * Checks the feature flag and assistant availability (no tool flag needed for suggested dashboards).
 */
export function isSuggestedDashboardAssistantEnabled(): Promise<boolean> {
  return firstValueFrom(
    isAssistantAvailable().pipe(
      map((assistantAvailable) => {
        const buttonEnabled = getFeatureFlagClient().getBooleanValue('suggestedDashboardsAssistantButton', false);
        return buttonEnabled && assistantAvailable;
      })
    )
  );
}

/**
 * Async function to check if the template dashboard assistant is enabled.
 * Both flags can be enabled in the specific wave/environment, but the assistant may not be available.
 * For example, cloud users without assistant access.
 */
export function isTemplateDashboardAssistantEnabled(): Promise<boolean> {
  return firstValueFrom(
    isAssistantAvailable().pipe(
      map((assistantAvailable) => {
        const buttonEnabled = getFeatureFlagClient().getBooleanValue('dashboardTemplatesAssistantButton', false);
        const toolEnabled = getFeatureFlagClient().getBooleanValue(
          'assistant.frontend.tools.dashboardTemplates',
          false
        );
        return buttonEnabled && toolEnabled && assistantAvailable;
      })
    )
  );
}
