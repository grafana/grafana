import { llms } from '@grafana/experimental';

import { getDashboardSrv } from '../../services/DashboardSrv';
import { PanelModel } from '../../state';

// TODO: Replace this approach with more stable approach
export const SPECIAL_DONE_TOKEN = '~';

const TITLE_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel titles for a given panel described by a JSON object' +
  'The title should be shorter than 50 characters. ' +
  `When you are done with the title, write "${SPECIAL_DONE_TOKEN}".`;

const DESCRIPTION_GENERATION_STANDARD_PROMPT =
  'You are an expert in creating Grafana Panels.' +
  'Your goal is to write short, descriptive, and concise panel descriptions for a given panel described by a JSON object.' +
  'The description should be shorter than 150 characters' +
  'Describe what this panel might be monitoring and why it is useful.' +
  `When you are done with the description, write "${SPECIAL_DONE_TOKEN}".`;

// TODO: Make this more robust (enum etc?)
const getContent = (subject: string) => {
  switch (subject) {
    case 'title':
      return TITLE_GENERATION_STANDARD_PROMPT;
    case 'description':
      return DESCRIPTION_GENERATION_STANDARD_PROMPT;
    default:
      return '';
  }
};

export interface GeneratePayload {
  dashboardTitle: string | undefined;
  dashboardDescription: string;
  panelTitles: string[];
  panelDescriptions: Array<string | undefined>;
  panelJson: any;
}

export const getGeneratePayloadForPanelTitleAndDescription = (panel: PanelModel): GeneratePayload => {
  const dashboard = getDashboardSrv().getCurrent();

  return {
    dashboardTitle: dashboard?.title,
    dashboardDescription: dashboard?.description,
    panelTitles: dashboard?.panels.map((panel) => panel.title).filter((title) => title && title !== '') ?? [],
    panelDescriptions: dashboard?.panels.map((panel) => panel.description || '').filter(Boolean) ?? [],
    panelJson: panel.getSaveModel(),
  };
};

export const onGenerateTextWithAI = async (
  payload: GeneratePayload,
  subject: string,
  setLlmReply: (response: string, subject: string) => void
) => {
  // Check if the LLM plugin is enabled and configured.
  // If not, we won't be able to make requests, so return early.
  const enabled = await llms.openai.enabled();
  if (!enabled) {
    return { enabled };
  }

  llms.openai
    .streamChatCompletions({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: getContent(subject),
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    })
    .pipe(
      // Accumulate the stream content into a stream of strings, where each
      // element contains the accumulated message so far.
      llms.openai.accumulateContent()
    )
    .subscribe((response) => setLlmReply(response, subject));

  return { enabled };
};
