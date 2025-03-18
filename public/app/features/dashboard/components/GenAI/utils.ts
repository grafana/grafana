import { pick } from 'lodash';

import { llm } from '@grafana/llm';
import { config } from '@grafana/runtime';
import { Panel } from '@grafana/schema';

import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';
import { NEW_PANEL_TITLE } from '../../utils/dashboard';

import { getDashboardStringDiff } from './jsonDiffText';

export enum Role {
  // System content cannot be overwritten by user prompts.
  'system' = 'system',
  // User content is the content that the user has entered.
  // This content can be overwritten by following prompt.
  'user' = 'user',
}

export type Message = llm.Message;

export enum QuickFeedbackType {
  Shorter = 'Even shorter',
  MoreDescriptive = 'More descriptive',
  Regenerate = 'Please, regenerate',
}

/**
 * The LLM model to be used.
 *
 * The LLM app abstracts the actual model name since it depends on the provider.
 * We want to default to whatever the 'large' model is.
 */
export const DEFAULT_LLM_MODEL: llm.Model = llm.Model.LARGE;

/**
 * Sanitize the reply from OpenAI by removing the leading and trailing quotes.
 */
export const sanitizeReply = (reply: string) => {
  return reply.replace(/^"|"$/g, '');
};

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
  userChanges: string;
  migrationChanges: string;
} {
  const { migrationDiff, userDiff } = getDashboardStringDiff(dashboard);

  return {
    userChanges: userDiff,
    migrationChanges: migrationDiff,
  };
}

// Shared healthcheck promise so avoid multiple calls llm app settings and health check APIs
let llmHealthCheck: Promise<boolean> | undefined;

/**
 * Check if the LLM plugin is enabled.
 * @returns true if the LLM plugin is enabled.
 */
export async function isLLMPluginEnabled(): Promise<boolean> {
  if (!config.apps['grafana-llm-app']) {
    return false;
  }

  if (llmHealthCheck) {
    return llmHealthCheck;
  }

  // Check if the LLM plugin is enabled.
  // If not, we won't be able to make requests, so return early.
  llmHealthCheck = new Promise((resolve) => {
    llm.health().then((response) => {
      if (!response.ok) {
        // Health check fail clear cached promise so we can try again later
        llmHealthCheck = undefined;
      }
      resolve(response.ok);
    });
  });

  return llmHealthCheck;
}

/**
 * Get the message to be sent to OpenAI to generate a new response.
 * @param previousResponse
 * @param feedback
 * @returns Message[] to be sent to OpenAI to generate a new response
 */
export const getFeedbackMessage = (previousResponse: string, feedback: string | QuickFeedbackType): Message[] => {
  return [
    {
      role: Role.system,
      content: `Your previous response was: ${previousResponse}. The user has provided the following feedback: ${feedback}. Re-generate your response according to the provided feedback.`,
    },
  ];
};

/**
 *
 * @param dashboard Dashboard to generate a title or description for
 * @returns String for inclusion in prompts stating what the dashboard's panels are
 */
export function getDashboardPanelPrompt(dashboard: DashboardModel): string {
  const panelStrings: string[] = getPanelStrings(dashboard);
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

export function getFilteredPanelString(panel: Panel): string {
  const keysToKeep: Array<keyof Panel> = ['datasource', 'title', 'description', 'targets', 'type'];

  const filteredPanel: Partial<Panel> = {
    ...pick(panel, keysToKeep),
    options: pick(panel.options, [
      // For text panels, the content property helps generate the panel metadata
      'content',
    ]),
  };

  return JSON.stringify(filteredPanel, null, 2);
}

export const DASHBOARD_NEED_PANEL_TITLES_AND_DESCRIPTIONS_MESSAGE =
  'To generate this content your dashboard must contain at least one panel with a valid title or description.';

export function getPanelStrings(dashboard: DashboardModel): string[] {
  const panelStrings = dashboard.panels
    .filter(
      (panel) =>
        (panel.title.length > 0 && panel.title !== NEW_PANEL_TITLE) ||
        (panel.description && panel.description.length > 0)
    )
    .map(getPanelString);

  return panelStrings;
}

const getPanelString = (panel: PanelModel, idx: number) =>
  `- Panel ${idx}
- Title: ${panel.title}${panel.description ? `\n- Description: ${panel.description}` : ''}`;
