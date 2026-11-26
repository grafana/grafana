import { firstValueFrom, map } from 'rxjs';

import { type ChatContextItem, createAssistantContextItem, isAssistantAvailable } from '@grafana/assistant';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
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
  kind: 'template_dashboard' | 'suggested_dashboard' | 'custom_dashboard_template'
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
  kind: 'template_dashboard' | 'suggested_dashboard' | 'custom_dashboard_template'
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
export function buildAssistantPrompt(
  kind: 'template_dashboard' | 'suggested_dashboard' | 'custom_dashboard_template'
): string {
  if (kind === 'suggested_dashboard') {
    return `Adapt this dashboard to my environment by connecting it to my available data sources and adjusting queries as needed.`;
  }
  return `Create a new dashboard based on this dashboard template.`;
}

/** The request when a template open in the editor goes to the Assistant without a prompt of its own. */
export const OPEN_TEMPLATE_PROMPT = 'Adapt this template to my data sources and adjust its queries as needed.';

/**
 * Builds the context item for a template already open in the dashboard editor as a new, unsaved dashboard, as the
 * template modal opens it: the Assistant adapts that dashboard in place instead of building one from a description. Uses
 * `name` rather than `templateName`, as suggested dashboards do, so the Assistant does not create the template again.
 */
export function buildOpenTemplateContextItem(template: {
  name: string;
  description?: string;
  author?: string;
}): ChatContextItem {
  const data: TemplateContextData = {
    name: template.name,
    description: template.description,
    author: template.author,
    instructions:
      'This template is open in the dashboard editor as a new, unsaved dashboard. Adapt that dashboard in place: ' +
      'read it with your dashboard tools, keep its layout, panels and variables unless the user asks for changes, ' +
      'and point every query that uses TestData, or a data source or metric the user does not have, at ' +
      "the user's own data sources after checking which metrics they actually expose. Do the same for its " +
      'variables and annotations. Do not create a new dashboard or load the template again, and do not save the ' +
      'dashboard: the user reviews and saves it.',
  };
  // The prompt pill is narrow: a "Dashboard Template:" prefix leaves no room for the name.
  return createAssistantContextItem('structured', { hidden: false, title: template.name, data });
}

/**
 * Async function to check if the suggested dashboard assistant is enabled.
 * Checks the feature flag and assistant availability (no tool flag needed for suggested dashboards).
 */
export function isSuggestedDashboardAssistantEnabled(): Promise<boolean> {
  return firstValueFrom(
    isAssistantAvailable().pipe(
      map((assistantAvailable) => {
        const buttonEnabled = getFeatureFlagClient().getBooleanValue(
          FlagKeys.SuggestedDashboardsAssistantButton,
          false
        );
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
        const buttonEnabled = getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardTemplatesAssistantButton, false);
        const toolEnabled = getFeatureFlagClient().getBooleanValue(
          FlagKeys.AssistantFrontendToolsDashboardTemplates,
          false
        );
        return buttonEnabled && toolEnabled && assistantAvailable;
      })
    )
  );
}
