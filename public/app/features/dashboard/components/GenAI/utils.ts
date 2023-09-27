import { DashboardModel, PanelModel } from '../../state';
import { Diffs, jsonDiff } from '../VersionHistory/utils';

import { openai } from './llms';

export enum Role {
  // System content cannot be overwritten by user prompts.
  'system' = 'system',
  // User content is the content that the user has entered.
  // This content can be overwritten by following prompt.
  'user' = 'user',
}

export type Message = openai.Message;

/**
 * The OpenAI model to be used.
 */
export const OPEN_AI_MODEL = 'gpt-4';

/**
 * Diff the current dashboard with the original dashboard and the dashboard after migration
 * to split the changes into user changes and migration changes.
 * * User changes: changes made by the user
 * * Migration changes: changes made by the DashboardMigrator after opening the dashboard
 *
 * @param dashboard current dashboard to be saved
 * @returns user changes and migration changes
 */
export function getDashboardChanges(dashboard: DashboardModel): {
  userChanges: Diffs;
  migrationChanges: Diffs;
} {
  // Re-parse the dashboard to remove functions and other non-serializable properties
  const currentDashboard = JSON.parse(JSON.stringify(dashboard.getSaveModelClone()));
  const originalDashboard = dashboard.getOriginalDashboard()!;
  const dashboardAfterMigration = JSON.parse(JSON.stringify(new DashboardModel(originalDashboard).getSaveModelClone()));

  return {
    userChanges: jsonDiff(dashboardAfterMigration, currentDashboard),
    migrationChanges: jsonDiff(originalDashboard, dashboardAfterMigration),
  };
}

/**
 * Check if the LLM plugin is enabled and configured.
 * @returns true if the LLM plugin is enabled and configured.
 */
export async function isLLMPluginEnabled() {
  // Check if the LLM plugin is enabled and configured.
  // If not, we won't be able to make requests, so return early.
  return await openai.enabled();
}

/**
 *
 * @param dashboard Dashboard to generate a title or description for
 * @returns String for inclusion in prompts stating what the dashboard's panels are
 */
export function getDashboardPanelPrompt(dashboard: DashboardModel): string {
  const getPanelString = (panel: PanelModel, idx: number) => `
  - Panel ${idx}\n
  - Title: ${panel.title}\n
  ${panel.description ? `- Description: ${panel.description}` : ''}
  `;

  const panelStrings: string[] = dashboard.panels.map(getPanelString);
  let panelPrompt: string;

  if (panelStrings.length <= 10) {
    panelPrompt = `The panels in the dashboard are:\n${panelStrings.join('\n')}`;
  } else {
    const withDescriptions = dashboard.panels.filter((panel) => panel.description);
    const withoutDescriptions = dashboard.panels.filter((panel) => !panel.description);
    let concatenatedPanelStrings;
    if (withDescriptions.length >= 10) {
      concatenatedPanelStrings = withDescriptions.slice(10).map(getPanelString).join('\n');
    } else {
      concatenatedPanelStrings = withDescriptions.map(getPanelString).join('\n');
      concatenatedPanelStrings += '\n';
      concatenatedPanelStrings += withoutDescriptions
        .slice(10 - withDescriptions.length)
        .map(getPanelString)
        .join('n');
    }
    panelPrompt =
      `There are ${panelStrings.length} panels.\n` +
      'Due to space constraints, only the information for ten of them is presented.\n' +
      'These ten are not necessarily the first ten, but prioritized to those with descriptions.\n' +
      `The panels in the dashboard are:\n${concatenatedPanelStrings}`;
  } // This truncation should prevent exceeding the allowed size for GPT calls.
  // Additionally, context windows that are too long degrade performance,
  // So it is possibly that if we can condense it further it would be better
  return panelPrompt;
}
