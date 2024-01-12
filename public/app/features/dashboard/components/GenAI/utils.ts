import { llms } from '@grafana/experimental';

import { DashboardModel, PanelModel } from '../../state';

import { getDashboardStringDiff } from './jsonDiffText';

export enum Role {
  // System content cannot be overwritten by user prompts.
  'system' = 'system',
  // User content is the content that the user has entered.
  // This content can be overwritten by following prompt.
  'user' = 'user',
}

export type Message = llms.openai.Message;

export enum QuickFeedbackType {
  Shorter = 'Even shorter',
  MoreDescriptive = 'More descriptive',
  Regenerate = 'Regenerate',
}

/**
 * The OpenAI model to be used.
 */
export const DEFAULT_OAI_MODEL = 'gpt-4';

export type OAI_MODEL = 'gpt-4' | 'gpt-4-32k' | 'gpt-3.5-turbo' | 'gpt-3.5-turbo-16k';

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

/**
 * Check if the LLM plugin is enabled.
 * @returns true if the LLM plugin is enabled.
 */
export async function isLLMPluginEnabled() {
  // Check if the LLM plugin is enabled.
  // If not, we won't be able to make requests, so return early.
  return llms.openai.health().then((response) => response.ok);
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
  const getPanelString = (panel: PanelModel, idx: number) =>
    `- Panel ${idx}
- Title: ${panel.title}${panel.description ? `\n- Description: ${panel.description}` : ''}`;

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

export function getFilteredPanelString(panel: PanelModel): string {
  const panelObj = panel.getSaveModel();

  const keysToKeep = new Set([
    'id',
    'datasource',
    'title',
    'description',
    'targets',
    'thresholds',
    'type',
    'xaxis',
    'yaxes',
  ]);

  const panelObjFiltered = Object.keys(panelObj).reduce((obj: { [key: string]: unknown }, key) => {
    if (keysToKeep.has(key)) {
      obj[key] = panelObj[key];
    }
    return obj;
  }, {});

  return JSON.stringify(panelObjFiltered, null, 2);
}
