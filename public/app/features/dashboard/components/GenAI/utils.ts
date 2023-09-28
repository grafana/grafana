import { llms } from '@grafana/experimental';

import { DashboardModel } from '../../state';
import { Diffs, jsonDiff } from '../VersionHistory/utils';

export enum Role {
  // System content cannot be overwritten by user prompts.
  'system' = 'system',
  // User content is the content that the user has entered.
  // This content can be overwritten by following prompt.
  'user' = 'user',
}

export type Message = llms.openai.Message;

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
  return await llms.openai.enabled();
}
